<!-- Translation: AI-generated, pending native review -->

# Criar conteúdo de lições

Este guia explica como criar um novo conjunto de lições para o
content-loader do Adaptive Learner. Qualquer pessoa que queira
publicar um conjunto de idioma ou tema — para uso pessoal ou
como contribuição para o repositório público de conteúdo —
deve ler isto do início ao fim antes de escrever qualquer
lição.

## O que é um conjunto de conteúdo

Um **conjunto de conteúdo** é um pacote versionado de lições
que um utilizador pode descarregar na página do Navegador de
Conjuntos (`/content`). O plugin Content-Loader (lançado em
v1.27.0) trata da descoberta, descarga, cache e reconciliação
de versões em ambos os modos de armazenamento.

Um conjunto tem três camadas:

1. **Manifesto raiz** (`manifest.yaml`) — lista todos os
   conjuntos enviados pelo repositório. Usado pelo Navegador
   de Conjuntos para apresentar o catálogo de fontes.
2. **Manifesto do conjunto** (`sets/{set-id}/manifest.yaml`) —
   companheiro do manifesto raiz, lista os ficheiros de lições
   dentro deste conjunto específico.
3. **Ficheiros de lições** (`sets/{set-id}/lessons/NN-slug.json`) —
   um ficheiro JSON por lição, validado contra o esquema v1.0
   em cada descarga.

Os conjuntos-piloto fornecidos com o Adaptive Learner vivem
no repositório de conteúdo separado
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(clonado como um sibling `../adaptive-learner-content` e
integrado na compilação por
`frontend/scripts/copy-bundled-content.mjs`) e são bons
modelos a copiar.

## Pares de idiomas (v1.44.0)

Cada conjunto de conteúdo declara o PAR de idiomas que
ensina:

- **`target_language`** — o que o aprendente está a
  APRENDER (por exemplo, `fr`).
- **`source_language`** — o que o aprendente JÁ FALA, ou
  seja, o idioma em que os campos **`back`** das fichas,
  **`notes`** e texto de **teoria** são escritos
  (por exemplo, `de`).

É por isso que "Francês para falantes de inglês" é um
conjunto *diferente* de "Francês para falantes de alemão":
mesmo alvo (`fr`), fonte diferente (`en` vs `de`), idioma
de explicação diferente. Um aprendente só vê conjuntos cujo
`source_language` corresponde a um idioma que fala (o seu
idioma da aplicação, mais quaisquer extras aceites em
Definições → Aprendizagem).

Os ids dos conjuntos codificam o par como
`{target}-{level}-from-{source}` (por exemplo,
`fr-a1-from-de`), e cada conjunto declara um **`path`** que
aponta para o diretório do idioma de origem
(`sets/de/fr-a1`). Um conjunto também transporta **`title`**
(no idioma de origem, o que o aprendente lê) e
**`title_native`** (no idioma alvo, apresentado como rótulo
secundário).

Ambos os códigos devem ser ISO 639-1 de 2 letras, e
`source_language` deve ser diferente de `target_language`.
Conjuntos anteriores a v1.2 sem estes campos ainda carregam:
a chave antiga `language` é aceite como `target_language` e
`source_language` assume o padrão `en`.

## Estrutura do sistema de ficheiros

A árvore está organizada por idioma de ORIGEM, depois
alvo+nível:

```
my-content-repo/
  manifest.yaml               # raiz: lista todos os conjuntos (com path + par)
  sets/
    de/                       # idioma de origem: alemão
      fr-a1/                  # alvo francês, nível A1  -> id fr-a1-from-de
        manifest.yaml         # conjunto: lista as lições
        lessons/
          01-begruessung.json
          ...
        assets/               # imagens / áudio opcionais
    en/                       # idioma de origem: inglês
      fr-a1/                  # -> id fr-a1-from-en
        ...
```

## Formato do manifesto

Ambos os ficheiros de manifesto (raiz + conjunto) utilizam a
mesma forma `schema_version: '1.0'`. Campos obrigatórios:

```yaml
schema_version: '1.0'
name: My English B1 set
description: >-
  Optional long-form description.
sets:
  - id: language-en-b1        # seguro para slug, único
    title: English B1 (Intermediate)
    language: en              # BCP-47 (por exemplo en, fr, zh-Hans)
    level: B1                 # CEFR para idiomas, livre noutros casos
    version: '1.0.0'          # semver — incrementado por versão do conjunto
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Optional set-level description.
    tags:
      - intermediate
      - business
metadata:
  author: Your Name
  license: CC-BY-SA-4.0       # ou o que for apropriado
```

O manifesto do conjunto lista adicionalmente todos os
ficheiros de lições:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

O Content-Loader percorre `metadata.lessons` por ordem;
a ordem dos ficheiros no diretório não importa, apenas a
ordem no manifesto.

## Esquema de lições (v1.0)

Cada lição é um único ficheiro JSON. Forma de nível superior:

```json
{
  "id": "01-greetings",
  "title": "Greetings",
  "description": "Optional 1-2 sentence summary.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Fichas

Uma ficha é a menor unidade de aprendizagem — tipicamente
um único termo ou conceito. Cada ficha tem um id estável
(referenciado nos exercícios) e um par frente/verso:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "the (masculine singular)",
  "notes": "Used before consonant-starting masculine nouns. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

As notas suportam Markdown. Use-as para dicas de
pronúncia, avisos de falsos amigos, alertas de formas
irregulares — tudo o que ajuda a retenção a longo prazo.
As etiquetas gerem a filtragem do SRS.

### Passos

Uma lição é uma sequência de passos, cada um sendo TEORIA
(um bloco Markdown) ou EXERCÍCIO (um dos quatro tipos de
exercício):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Why articles matter",
  "body": "# Articles in French\n\nEvery French noun has a gender..."
}
```

Ou um exercício:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Match greetings",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Match each greeting to its translation.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hello"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Referência de tipos de exercício

### matching

Exercício de arrastar e combinar. O renderer baralha antes
de apresentar.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Match each French noun with its article.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Cada par deve ter exatamente duas chaves: `left` + `right`.

### picture_choice

Escolha múltipla com imagens. ≥ 2 imagens, exatamente uma
marcada como correta.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Which is the evening greeting?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optional Markdown hint shown on demand.",
  "distractors": ["Bonjour"]
}
```

Nota: `is_correct` é uma **string** `"true"`, não um booleano
JSON.

Se `src` apontar para um recurso que não existe, o renderer
volta ao texto `label` — os exercícios picture-choice
continuam a funcionar mesmo sem imagens ilustrativas.

### free_text

Escrever a resposta. O renderer faz primeiro correspondência
exata, depois um fallback tolerante a erros por Levenshtein.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "How do you say 'Thank you' in French?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "It starts with M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` é a resposta canónica mostrada após uma tentativa
errada. Inclua ≥ 3 variantes para cobrir maiúsculas e
pontuação; o renderer normaliza os espaços.

### word_tiles

Arranjar tiles em ordem. O renderer baralha antes de
apresentar.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Arrange: I see a cat.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Same word order as English."
}
```

Se múltiplas ordens de palavras estiverem corretas, adicione
`accept_orderings`:

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Cada ordenação é uma permutação dos índices dos tiles.

### cloze (Phase 52 / v1.35.0 — esquema 1.1)

Preencher os espaços em branco com marcadores `___` visíveis
na frase. Cada `___` corresponde a uma entrada em `blanks[]`
(mapeamento da esquerda para a direita; o carregador impõe
`sentence.count("___") == len(blanks)`).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Fill in the indefinite article.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "masculine indefinite article",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* is the masculine indefinite article."
}
```

**Modos de renderização** — definidos por exercício via
`cloze_mode`:

- `"type"` (padrão quando omitido): um `<input>` por espaço.
  Validado com o mesmo matcher NFC + Levenshtein-≤-1 que
  free_text usa, pelo que os autores só precisam de enumerar
  variantes semânticas (não erros tipográficos).
- `"select"`: um `<select>` por espaço. Opções retiradas de
  `accept[0]` + os `distractors` do exercício, baralhados por
  espaço com uma semente estável. **Requer `distractors`
  não vazio** — o validador de esquema rejeita exercícios
  `cloze_mode: "select"` sem eles.

**Cloze multi-espaço** é suportado: cada `___` na frase
mapeia para a próxima entrada em `blanks`, por ordem. Cada
espaço pode ter a sua própria dica + placeholder + lista
accept. O SRS ao nível de elemento propaga um ElementAttempt
por espaço, pelo que um aprendente que preenche fluentemente
o espaço A mas falha consistentemente o espaço B obtém
rastreamento de domínio por espaço.

**Token-roles nas fichas (Phase 52I / v1.35.0)** — metadados
opcionais na Ficha que permitem ao gerador de cloze em tempo
de execução (sessões de revisão + ronda de correção no final
da lição) escolher um espaço semanticamente significativo:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "a cat",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Enum fechado de papéis: `article` / `verb` / `noun` /
`adjective` / `preposition` / `gender_marker` /
`tense_marker`. Adicionar um papel é um incremento menor de
schema_version — não estenda no lugar.

## Direção dos exercícios (v1.46.0 / EXP-018)

Cada exercício aceita um campo opcional `direction` que indica
de que forma o aprendente pratica a ficha:

- `target_to_source` (padrão) — RECETIVO: o aprendente vê o
  idioma alvo e reconhece o idioma de origem (mais fácil).
- `source_to_target` — PRODUTIVO: o aprendente vê o idioma
  de origem e produz o alvo (mais difícil).
- `both` / `random` — deixar o renderer / gerador adaptativo
  escolher uma direção concreta por tentativa.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

O campo é aditivo — o esquema permanece na versão 1.2 e
lições sem `direction` comportam-se exatamente como antes
(recetivo). O SRS rastreia o domínio por direção, pelo que
uma ficha dominada recetivamente ainda não está dominada
produtivamente. Os exercícios cloze são em contexto e
ignoram `direction`. Para uma progressão de dificuldade,
mantenha as primeiras lições recetivas e introduza
`source_to_target` nas lições mais avançadas (o conteúdo
piloto integrado faz exatamente isto).

### Anotações que ajudam o gerador de lições adaptativo (v1.36.0+)

O gerador de lições adaptativo da Phase 53
(`/adaptive-lesson/:setId`, F-114) recombina exercícios
criados pelo autor para praticar as fraquezas específicas
do aprendente. O gerador funciona sem anotações extra, mas
dois campos tornam-no materialmente mais inteligente:

1. **Cobertura mais ampla de `token_roles` nas fichas.** O
   gerador usa `token_roles` para:
   - Escolher espaços semanticamente significativos ao
     gerar variantes cloze a partir de erros (já coberto
     em v1.35.0)
   - Classificar erros como `article_gender` /
     `verb_conjugation` para os chips "Áreas de foco" do
     Dashboard (53E)
   - Encontrar exercícios ALTERNATIVOS que testam o mesmo
     elemento quando o utilizador errou o original (lógica
     de variação 53D — encontra candidatos cuja ficha tem
     uma entrada `token_roles` correspondente)

   Adicione uma entrada `token_roles` a CADA ficha que
   ensina uma unidade gramatical discreta — artigos, formas
   verbais conjugadas, substantivos com género. O custo é
   uma entrada JSON extra por ficha; a recompensa é uma
   geração adaptativa muito mais rica.

2. **Etiquetas de gramática ao nível da ficha
   (`tags: ["article", "masculine"]`, etc.)** são lidas pelo
   classificador de erros como fallback quando `token_roles`
   está ausente. Não substituem `token_roles` — são uma
   anotação intermédia de baixo esforço.

O que ainda NÃO é necessário (adiado para um futuro
incremento de esquema):

- Referências cruzadas `related_cards` entre fichas de
  diferentes lições
- Classificações de dificuldade por exercício (o gerador
  estima a dificuldade a partir de `exercise.type` hoje)
- Frases de exemplo por ficha em `notes` analisáveis como
  contextos alternativos de cloze (o gerador de cloze usa
  apenas `front`)

Em caso de dúvida: adicione `token_roles` a cada ficha que
ensina um token gramatical. Esse é o hábito de autoria de
maior impacto para o sistema adaptativo.

## Recursos (imagens integradas num conjunto) — v1.37.0+

Exercícios picture-choice e imagens de capa das fichas
provêm de:
1. **Ficheiros de recursos criados pelo autor**, declarados
   no manifesto ao nível do conjunto e enviados juntamente
   com o JSON da lição
2. **SVGs placeholder**, gerados em tempo de execução quando
   não existe nenhum recurso (amostras de cor para rótulos
   de cor, numerais grandes para dígitos, avatar-estilo para
   tudo o resto)

Se publicar um conjunto sem quaisquer recursos, picture-choice
ainda funciona — o gerador de SVG placeholder trata as cores
+ números automaticamente, e volta a um avatar determinístico
para tudo o resto.

### Estrutura do diretório

Dentro do diretório de um conjunto, os recursos ficam em
`assets/`:

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

Cada recurso deve ser declarado no `manifest.yaml` ao nível
do conjunto para que o descarregador saiba o que buscar:

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

O `path` é relativo ao diretório `assets/` do conjunto (NÃO
ao JSON da lição). Dentro do JSON da lição, os exercícios
picture-choice referenciam os recursos COM o prefixo
`assets/`:

```json
{
  "type": "picture_choice",
  "prompt": "Which one is 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Cat", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Dog"}
  ]
}
```

O frontend remove o prefixo `assets/` automaticamente ao
chamar o resolvedor de recursos, pelo que o JSON da lição
mantém a forma intuitiva que os autores esperam.

### Limites de tamanho + formato

- **Limite por recurso**: 500 KiB. O validador do manifesto
  rejeita recursos cujo `size_kb` declarado exceda este valor.
  O descarregador também rejeita recursos cujo comprimento
  real em bytes exceda o `size_kb` declarado em mais de 10%
  — mantém o manifesto honesto.
- **Limite suave por conjunto**: 10 MiB total de recursos.
  O validador avisa mas não rejeita.
- **Formatos aceites**: `.png` / `.jpg` / `.jpeg` / `.webp`
  / `.svg`. Sem GIF (conteúdo animado é uma distração) e sem
  BMP (sem compressão). Para fotos, prefira WebP — muito
  menor que PNG com qualidade comparável. Para ícones +
  diagramas, prefira SVG — escala bem + tamanho de ficheiro
  pequeno.

### Recomendações de dimensionamento

Os tiles picture-choice renderizam com máx. 150x150 px em
computador, 100x100 px em telemóvel (`object-fit: contain`).
Imagens de origem de 300x300 px dão o melhor resultado em
ecrãs Retina sem sobrecarga. PNGs acima de 150 KiB raramente
ficam melhor do que um WebP devidamente comprimido a metade
do tamanho.

### Ignorar imagens criadas pelo autor — deixar o placeholder de runtime cobrir

Três tipos de lições onde o placeholder de runtime é bom o
suficiente para que imagens criadas pelo autor não acrescentem
valor de aprendizagem:

- **Lições de cores** (`rouge` / `rojo` / `rot` / `red`): o
  gerador de placeholder produz uma amostra hexadecimal sólida
  associada ao nome da cor. Amostras criadas pelo autor são
  redundantes.
- **Lições de números** (`7` / `42` / `1492`): o placeholder
  renderiza os dígitos grandes + centrados. Imagens criadas
  pelo autor só importariam para sistemas de numeração
  não-arábicos.
- **Conceitos abstratos** sem representação visual óbvia
  (`patience`, `liberté`): o placeholder de avatar dá uma
  âncora visual limpa sem forçar uma escolha de ícone
  contestada.

Para tudo o resto (animais, objetos, comida, lugares, partes
do corpo), imagens criadas pelo autor ajudam materialmente
o reconhecimento + a recordação.

## Lista de verificação de qualidade

Antes de abrir um PR para uma nova lição, verifique:

- [ ] **3-5 passos de teoria** + **8-12 exercícios** por lição
- [ ] **Pelo menos 3 tipos de exercício** representados (matching, picture-choice, free-text, word-tiles ou cloze — cloze disponível em v1.35.0+)
- [ ] **Passos de teoria ≤ 200 palavras** cada
- [ ] **Exercícios free-text**: ≥ 3 variantes accept + ≥ 3 distractors
- [ ] **Word-tiles**: ≥ 3 tiles por exercício
- [ ] **estimated_minutes**: 10-15 (realista, não aspiracional)
- [ ] **Distractors são errados-mas-plausíveis** — semanticamente relacionados, nunca aleatórios
- [ ] **Notas das fichas** transportam valor real (pronúncia, falso amigo, sinalização de exceção)
- [ ] **Estrutura progressiva**: conceitos posteriores baseiam-se em anteriores no mesmo conjunto
- [ ] **Precisão cultural**: uso do mundo real, não apenas frases de manual
- [ ] **Validação de esquema**: a lição carrega corretamente via `dict_to_lesson()` (ver Testes locais)
- [ ] **Integridade de card-id**: cada `exercise.card_ids[i]` existe em `cards[]` da lição
- [ ] **Par de idiomas**: `target_language` + `source_language` definidos (ISO 639-1, diferentes), `title_native` presente

## Validação (duas camadas, v1.44.0)

O conteúdo é controlado por duas camadas de validação que
executam os MESMOS controlos:

1. **Na aplicação, antes de partilhar.** Quando um aprendente
   partilha uma lição via *As Minhas Lições → Partilhar com
   a Comunidade*, um controlo baseado em regras é executado
   primeiro (sempre, sem necessidade de IA). Impõe os
   **mínimos** abaixo; um conjunto abaixo de qualquer deles
   não pode ser partilhado. Se passar E uma chave de IA
   estiver configurada, o aprendente pode ativar uma revisão
   de IA suplementar (precisão de tradução, plausibilidade
   dos distractors, gramática, adequação de nível,
   sensibilidade cultural, naturalidade). O passo de IA
   nunca é automático, requer consentimento explícito (o
   conteúdo da lição é enviado ao fornecedor configurado), e
   nunca bloqueia a partilha — a aprovação baseada em regras
   é a porta.
2. **No CI do repositório de conteúdo.** Um pull request para
   `astrapi69/adaptive-learner-content` executa
   `scripts/validate_content.py` (espelhado em
   `docs/ci/adaptive-learner-content/`), que verifica
   novamente todos os conjuntos com as mesmas regras para que
   um PR manual não possa contornar a porta.

**Mínimos de qualidade (porta obrigatória):** ≥ 5 exercícios
por lição, ≥ 2 tipos de exercício, ≥ 1 passo de teoria,
free-text ≥ 2 respostas aceites + distractors, matching ≥ 3
pares, distractors em picture-choice, sem frente/verso de
ficha vazios e (para scripts de origem não-latinos) versos
das fichas no script de origem. Estes são mínimos, não alvos
— a lista de verificação acima pede mais.

## Testes locais

O validador de esquema do Content-Loader é executado como
parte de `make test`. Para validar uma única lição
manualmente:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} cards, {len(lesson.steps)} steps')
"
```

Para validar todas as lições de um repositório de conteúdo
de uma vez, use o próprio validador do repositório de
conteúdo (o mesmo script que o seu CI executa em cada PR):

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

Descobre todos os conjuntos em `sets/{source}/{target-level}/`
e verifica o esquema mais os mínimos de qualidade (≥5
exercícios, ≥2 tipos de exercício, ≥1 passo de teoria,
accept + distractors de free-text, pares de matching, sem
fichas vazias, integridade de card-id) em cada um. Adicionar
uma nova lição é detetado automaticamente — não é necessário
editar nenhum teste.

## Fluxo de trabalho de PR

Quando o seu conjunto estiver pronto:

1. Abra um PR contra o repositório principal do
   adaptive-learner (para conjuntos que devem ser enviados
   com a aplicação), OU
2. Crie o seu próprio repositório de conteúdo na sua conta
   GitHub e aponte o Content-Loader para ele a partir de
   `backend/config/plugins/content-loader.yaml` (em
   `default_sources`).

O Content-Loader suporta qualquer repositório GitHub público
como fonte. Repositórios privados requerem um token de
acesso pessoal configurado via a cadeia de chaves de três
camadas (`~/.config/adaptive_learner/secrets.yaml`).

## Armadilhas comuns

**Referências de card-id**: cada entrada `card_ids` num
exercício deve existir em `cards[]` da lição. Se copiar um
exercício entre lições e se esquecer de copiar a ficha, a
validação falha.

**Ids seguros para slug**: todos os ids (lição, ficha, passo,
exercício) devem corresponder a `^[a-z0-9]+(-[a-z0-9]+)*$`.
Sem sublinhados, sem apóstrofos, sem letras maiúsculas, sem
hífenes no início/fim.

**`is_correct: "true"`**: é uma string, não um booleano JSON.
O esquema requer especificamente `"true"` porque os campos
picture-choice são todos dict[str, str] internamente.

**Campos extra**: cada modelo tem `extra="forbid"`. Adicionar
um campo que o esquema não conhece irá rejeitar toda a lição.
Mantenha-se nos campos documentados.

**Corpo da teoria**: os passos de teoria requerem um campo
`body` não vazio (Markdown). Os passos de exercício não devem
ter `body` — use o `prompt` do exercício.

## Referência: os conjuntos piloto

Os dois conjuntos enviados com o Adaptive Learner são as
referências canónicas:

- `sets/en/fr-a1/` — Francês A1 para falantes de inglês
  (10 lições, ~2 horas no total); `sets/de/fr-a1/` é o
  piloto em alemão como fonte.
- `sets/en/es-a1/` + `sets/de/es-a1/` — Espanhol A1 (15
  lições cada fonte), no repositório
  `adaptive-learner-content`.

Ambos seguem as convenções descritas neste guia. Ler uma
lição completa do início ao fim antes de criar a sua própria
é a forma mais rápida de interiorizar a estrutura.

---

## Via de contribuição para a comunidade (v1.42.0)

Não é necessário criar lições manualmente do zero. A forma
mais rápida de contribuir é **criar uma lição na aplicação e
partilhá-la**:

1. Importe uma conversa e analise-a, depois **Guardar como
   Lição Offline** (ou termine uma lição adaptativa e
   **Guardar esta lição?**). A lição aparece em **As Minhas
   Lições** no Navegador de Conjuntos.
2. Em As Minhas Lições, clique em **Exportar como conjunto**
   para descarregar um `.zip` de conjunto de conteúdo
   (manifesto + lições). As exportações contêm apenas o
   conteúdo da lição — sem progresso, sem histórico de erros,
   nada pessoal.
3. Clique em **Partilhar com a Comunidade** para abrir um
   problema GitHub pré-preenchido no repositório de conteúdo.
   Anexe o `.zip` exportado.
4. Um mantenedor revê a lição, organiza o manifesto (id,
   título, idioma, nível, etiquetas) para corresponder às
   convenções acima, e adiciona-a em `sets/`. Uma vez fundida,
   toda a gente pode descarregá-la no Navegador de Conjuntos.

Este é o caminho social: a revisão é **manual** (um
mantenedor cuida de cada adição — nada é publicado
automaticamente), e todo o fluxo requer apenas o GitHub.
As lições geradas já validam contra o esquema, pelo que uma
lição contribuída geralmente precisa apenas de polimento do
manifesto antes de ser lançada.

## Assistente de partilha, variações e crédito de autor (Phase 64)

Partilhar uma lição em **As Minhas Lições** abre um assistente
de quatro passos em vez de saltar diretamente para o GitHub:

1. **Pré-visualização + colocação.** A aplicação calcula
   exatamente onde a lição ficará na árvore
   (`sets/{source}/{target}-{level}/`) e um nome de ficheiro
   auto-numerado (`{nn}-{slug}.json`, o número seguinte após
   as lições existentes). Um par + nível completamente novo
   mostra *"Novo conjunto! Você é o primeiro."*
2. **Controlo de duplicados.** A lição é comparada com as
   lições já nesse caminho de árvore por sobreposição de
   fichas e sobreposição de exercícios (consultivo — nunca
   bloqueia). Se existir algo semelhante pode:
   - **Partilhar como variação** — a lição é marcada com
     `variation_of: "{original_id}"` mais uma
     `variation_note` opcional ("como é que a sua versão
     difere?").
   - **Sugerir apenas os novos exercícios** (quase
     duplicados) — o assistente extrai apenas os exercícios
     que o original não tem, mais as fichas que eles
     referenciam, como uma variação suplementar.
3. **Resumo de qualidade.** Os resultados do validador
   baseado em regras (mais a revisão de IA opcional); os
   avisos são apresentados mas nunca bloqueiam.
4. **Partilhar + celebrar.** Um clique abre o PR/problema do
   GitHub e a aplicação agradece-lhe com uma pequena
   celebração.

### Campos de variação + crédito (esquema 1.3, todos opcionais)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "More exercises on agreement",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

Todos os quatro são aditivos e opcionais; lições sem eles
comportam-se exatamente como antes. `contributed_by` é
definido quando o autor opta por crédito ao partilhar (um
campo *"O seu nome (opcional)"* que é lembrado localmente
para a próxima vez). Quando presente, o visualizador mostra
uma linha discreta *"Contribuído por {nome}"* abaixo do
título e o problema do GitHub lista o autor na sua tabela
de metadados.

### Histórico de contribuições e lacunas

As lições partilhadas são lembradas localmente (sem conta
necessária) em **As Minhas Contribuições** com um contador
e um reconhecimento de *Contribuidor da Comunidade* nas cinco
partilhas. O Navegador de Conjuntos também apresenta
**Lições em Falta** — sugerindo o próximo nível CEFR de um
par existente, ou um alvo ensinado para um idioma de origem
mas ausente para outro ("Pode ajudar?").
