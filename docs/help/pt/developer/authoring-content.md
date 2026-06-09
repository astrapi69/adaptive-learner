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
   um ficheiro JSON por lição, validado contra o esquema v1.0 em
   cada download.

Os conjuntos piloto fornecidos com o Adaptive Learner ficam no repo
de conteúdo separado [`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(checkout como irmão `../adaptive-learner-content` e empacotado pela
build através de `frontend/scripts/copy-bundled-content.mjs`) e
servem bem como modelo.

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

Ambos os códigos têm de ser ISO-639-1 (duas letras), e
`source_language` tem de ser diferente de `target_language`. Os
conjuntos anteriores à v1.2 sem estes campos continuam a carregar: a
antiga chave `language` é aceite como `target_language`, e
`source_language` recai em `en`.

## Layout de diretórios

A árvore está organizada por IDIOMA DE ORIGEM, depois destino+nível:

```
meu-content-repo/
  manifest.yaml               # Raiz: lista cada conjunto (com path + par)
  sets/
    de/                       # Idioma de origem: Alemão
      fr-a1/                  # Destino Francês, nível A1  -> ID fr-a1-from-de
        manifest.yaml         # Conjunto: lista as lições
        lessons/
          01-begruessung.json
          ...
        assets/               # imagens / áudio opcionais
    en/                       # Idioma de origem: Inglês
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

## Formato do manifesto

Ambos os ficheiros de manifesto (raiz + conjunto) usam a mesma forma
com `schema_version: '1.0'`. Campos obrigatórios:

```yaml
schema_version: '1.0'
name: Mein Englisch-B1-Set
description: >-
  Optionale Langbeschreibung.
sets:
  - id: language-en-b1        # slug-sicher, eindeutig
    title: Englisch B1 (Fortgeschrittene)
    language: en              # BCP-47 (z.B. en, fr, zh-Hans)
    level: B1                 # CEFR für Sprachen, frei für andere Domänen
    version: '1.0.0'          # Semver — pro Set-Release erhöht
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Optionale Set-Beschreibung.
    tags:
      - intermediate
      - business
metadata:
  author: Dein Name
  license: CC-BY-SA-4.0       # oder die Lizenz deiner Wahl
```

O manifesto do conjunto lista adicionalmente cada ficheiro de lição:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

O content-loader itera `metadata.lessons` pela ordem dada; os nomes
dos ficheiros no disco são irrelevantes — só conta a ordem do
manifesto.

## Esquema de lição (v1.0)

Cada lição é um único ficheiro JSON. Estrutura de topo:

```json
{
  "id": "01-greetings",
  "title": "Begrüßungen",
  "description": "Optionale 1-2-Satz-Zusammenfassung.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Cards

Um Card é a menor unidade aprendível — tipicamente um único termo ou
conceito. Cada Card tem um id estável (referenciado a partir dos
exercícios) e um par front/back:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "der (männlich Singular)",
  "notes": "Vor konsonantenanfangenden männlichen Substantiven. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

`notes` aceita Markdown. Usa-as para regras de pronúncia, avisos de
falsos amigos, notas de exceção — tudo o que melhore a memorização a
longo prazo. As `tags` controlam o filtro do SRS.

### Steps

Uma lição é uma sequência passo a passo, cada passo ou THEORY (um
bloco Markdown) ou EXERCISE (um dos quatro tipos de exercício):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Warum Artikel wichtig sind",
  "body": "# Artikel im Französischen\n\nJedes französische Nomen hat ein Geschlecht..."
}
```

Um passo de teoria pode trazer opcionalmente um **link de exemplo**
(esquema v1.4, aditivo — as lições existentes permanecem válidas sem
ele). Se presente, o visualizador renderiza por baixo um botão para
abrir o exemplo:

```json
{
  "id": "intro",
  "type": "theory",
  "body": "Die Korrelation misst den Zusammenhang...",
  "example_url": "https://example.com/correlation-visualizer",
  "example_label": "Interaktive Visualisierung"
}
```

- `example_url` (opcional): tem de ser um URL `http(s)`.
- `example_label` (opcional): o texto do link; vazio torna-se um
  "Ver exemplo" localizado.

Ou um exercício:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Begrüßungen zuordnen",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Ordne jede Begrüßung ihrer Übersetzung zu.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hallo"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Referência dos tipos de exercício

### matching

Exercício de arrastar pares. O renderizador baralha antes da
apresentação.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Ordne jedem französischen Nomen seinen Artikel zu.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Cada Pair tem de ter exatamente duas chaves: `left` + `right`.

### picture_choice

Escolha múltipla com imagens. ≥ 2 imagens, exatamente uma marcada
como correta.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Welche Begrüßung passt zum Abend?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optionaler Markdown-Tipp auf Knopfdruck.",
  "distractors": ["Bonjour"]
}
```

Importante: `is_correct` é uma **string** `"true"`, não um booleano
JSON.

Se o caminho `src` aponta para um ficheiro inexistente, o
renderizador recai no `label` — portanto o picture_choice funciona
também sem assets de ilustração.

### free_text

Escrever a resposta. O renderizador faz primeiro correspondência
exata, depois tolerante a Levenshtein.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "Wie sagt man 'Danke' auf Französisch?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Beginnt mit M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` é a resposta canónica, mostrada numa tentativa errada.
Lista ≥ 3 variantes para cobrir maiúsculas/minúsculas + pontuação; o
espaço em branco é normalizado pelo renderizador.

### word_tiles

Pôr peças na ordem correta. O renderizador baralha antes da
apresentação.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Bring die Kacheln in die Reihenfolge: Ich sehe eine Katze.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Gleiche Wortreihenfolge wie im Deutschen."
}
```

Se várias ordens de palavras forem corretas, acrescenta
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

Cada ordem é uma permutação dos índices das peças.

### cloze (Fase 52 / v1.35.0 — Esquema 1.1)

Texto com lacunas com marcadores `___` visíveis na frase. Cada
`___` corresponde a uma entrada em `blanks[]` (mapeamento da
esquerda para a direita; o loader verifica `sentence.count("___") ==
len(blanks)`).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Setze den unbestimmten Artikel ein.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "männlicher unbestimmter Artikel",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* ist der männliche unbestimmte Artikel."
}
```

**Modos de renderização** — definidos por exercício via `cloze_mode`:

- `"type"` (padrão, se não definido): um `<input>` por lacuna.
  Valida com o mesmo matcher NFC + Levenshtein-≤-1 que o texto
  livre, de forma que os autores só precisam de listar variantes
  semânticas (sem erros de digitação).
- `"select"`: um `<select>` por lacuna. As opções vêm de
  `accept[0]` + `distractors` do exercício, baralhadas por lacuna com
  uma seed estável. **Requer `distractors` não vazios** — o
  validador de esquema rejeita `cloze_mode: "select"` sem eles.

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
   `astrapi69/adaptive-learner-content` executa
   `scripts/validate_content.py` (espelhado em
   `docs/ci/adaptive-learner-content/`) e verifica cada conjunto com
   as mesmas regras, para que um PR manual não contorne o portão.

**Valores mínimos de qualidade (portão rígido):** ≥ 5 exercícios por
lição, ≥ 2 tipos de exercício, ≥ 1 passo de teoria, free-text ≥ 2
respostas aceites + distratores, matching ≥ 3 pares, picture-choice
com distratores, sem frente/verso de cartão vazios e (em escritas de
origem não latinas) versos de cartão na escrita de origem. Estes são
valores mínimos, não metas — a lista de verificação acima exige mais.

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

## Referência: os conjuntos piloto

Os dois conjuntos fornecidos com o Adaptive Learner são as
referências canónicas:

- `sets/en/fr-a1/` — Francês A1 para falantes de inglês (10 lições,
  ~2 horas); `sets/de/fr-a1/` é o conjunto piloto em alemão.
- `sets/en/es-a1/` + `sets/de/es-a1/` — Espanhol A1 (15 lições por
  idioma de origem), no repo `adaptive-learner-content`.

Ambos seguem as convenções descritas neste guia. Ler uma lição
completa é o caminho mais rápido para interiorizar a estrutura.

---

## Caminho para a participação na comunidade (v1.42.0)

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
