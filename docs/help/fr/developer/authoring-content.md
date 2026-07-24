# Créer des contenus de leçon

Ce guide décrit pas à pas comment mettre en place un nouvel
ensemble de leçons pour le chargeur de contenu d'Adaptive Learner.
Qui veut construire un ensemble linguistique ou thématique - pour
son propre usage ou comme contribution au pool de contenu public -
devrait le lire entièrement une fois avant la première leçon.

## Qu'est-ce qu'un ensemble de contenu ?

Un **ensemble de contenu** est un paquet versionné de leçons qu'un
utilisateur peut télécharger via la page du navigateur d'ensembles
(`/content`). Le plugin de chargeur de contenu (v1.27.0) prend en
charge la découverte, le téléchargement, la mise en cache et la
comparaison de versions dans les deux modes de stockage.

Un ensemble a trois niveaux :

1. **Manifeste racine** (`manifest.yaml`) - liste chaque ensemble
   du dépôt. Lu par le navigateur d'ensembles pour le catalogue de
   sources.
2. **Manifeste d'ensemble** (`sets/{set-id}/manifest.yaml`) -
   sœur du manifeste racine, liste les fichiers de leçon de
   l'ensemble concret.
3. **Fichiers de leçon** (`sets/{set-id}/lessons/NN-slug.json`) -
   un fichier JSON par leçon, validé à chaque téléchargement contre
   le schéma de leçon (voir *Le schéma est la source de vérité
   unique* ci-dessous).

Les ensembles livrés avec Adaptive Learner se trouvent dans le
dépôt de contenu séparé
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(extrait comme checkout frère `../adaptive-learner-content` et
empaqueté hors ligne dans le build GitHub Pages via
`frontend/scripts/copy-bundled-content.mjs`) et constituent de bons
modèles. La taille actuelle de la bibliothèque (nombres de leçons /
d'ensembles / de domaines, le tableau par ensemble et les domaines
actifs) est le bloc CONTENT-STATS du
[`README.md`](https://github.com/astrapi69/adaptive-learner#readme)
du projet - ce bloc est la source de vérité unique, généré à partir
d'un checkout de contenu frais, de sorte que ce guide ne duplique
pas les chiffres.

## Le schéma est la source de vérité unique (EXP-039)

Le format de leçon/exercice a **une définition canonique** : le JSON
Schema de leçon livré par le paquet npm
[learn-content-engine](https://github.com/astrapi69/learn-content-engine)
(immuable par release publiée). Dans cette app, la couche Pydantic
**structurelle** du plugin de chargement de contenu
(`adaptive_learner_content_loader.schema`) est **régénérée** à partir
de ce miroir (`scripts/generate_pydantic_models.py`) ; seuls les
validateurs sémantiques inter-champs sont écrits à la main.
`make sync-schema` rafraîchit le miroir et réémet les artefacts
dérivés, et des barrières de parité d'octets prouvent que
`schema/*.json` est identique à la release épinglée de l'engine. Les
endroits qui dérivaient autrefois ne le peuvent plus :

- `schema/lesson.schema.json` (+ fichiers frères) : le JSON Schema
  lisible par machine (Draft 2020-12). Référence-le depuis un `.json`
  de leçon via une clé `"$schema"` de premier niveau pour obtenir
  l'autocomplétion de l'IDE et la validation en ligne.
- `schema/quality-rules.json` : les minimums de qualité partagés
  (p. ex. nombre d'exercices, nombre de réponses acceptées en
  free-text), consommés par le validateur de contenu côté client au
  lieu d'une seconde copie entretenue à la main.
- Les types de leçon TypeScript du frontend et la page MkDocs
  [Lesson format reference](lesson-format-reference.md) sont eux
  aussi générés (**ne les édite pas à la main**) ; ils suivent le
  miroir de l'engine, relance donc le générateur après chaque
  re-pin.

Une barrière anti-dérive (`make sync-schema-check`, partie de
`release-test`, plus `backend/tests/test_lesson_schema_drift.py` dans
`make test`) échoue si un artefact généré diverge du miroir épinglé
de l'engine. La fermeture de la chaîne est la barrière de parité
d'octets app-contre-engine : `make engine-parity-check`
(`scripts/check_engine_schema_parity.py`), le pin hors ligne
`engine-schema-parity.test.ts` et le test de cohérence du pin
`engine-pin.test.ts` (dépendance de `frontend/package.json` ==
`schema/engine-version.txt`). Les dépôts de contenu reflètent **la
release épinglée de l'engine** (pas ce dépôt) et valident contre ce
miroir dans leur propre CI.

**Procédure de changement de format (autorité du schéma dans
l'engine) :** un changement du format de leçon commence dans l'engine,
ou y est ratifié : d'abord PR engine + release npm ; ensuite cette app
monte le pin de l'engine (`frontend/package.json` +
`schema/engine-version.txt`) et relance `make sync-schema`, qui
rafraîchit le miroir et régénère la couche Pydantic structurelle ;
seuls les nouveaux validateurs sémantiques sont écrits à la main ;
puis les dépôts de contenu réépinglent leur `engine-version.txt`. Une
édition manuelle du miroir (ou un pin périmé) fait passer au rouge
les barrières de parité d'octets ; l'étape oubliée devient visible,
jamais de dérive silencieuse.

## Paires de langues (v1.44.0)

Chaque ensemble de contenu déclare la PAIRE de langues qu'il
transmet :

- **`target_language`** - ce que l'apprenant APPREND (p. ex.
  `fr`).
- **`source_language`** - ce que l'apprenant PARLE déjà, donc la
  langue dans laquelle sont écrits les champs **`back`** des cartes,
  les **`notes`** et le texte de **théorie** (p. ex. `de`).

C'est précisément cela qui fait de « Français pour anglophones » un
ensemble *différent* de « Français pour germanophones » : même
cible (`fr`), autre langue de départ (`en` vs `de`), autre langue
d'explication. Un apprenant ne voit que les ensembles dont la
`source_language` correspond à une langue qu'il parle (langue de
l'application plus les langues supplémentaires optionnelles dans
Paramètres → Apprentissage).

Les identifiants d'ensemble encodent la paire sous la forme
`{cible}-{niveau}-from-{source}` (p. ex. `fr-a1-from-de`), et
chaque ensemble déclare un **`path`** qui pointe vers son
répertoire de langue source (`sets/de/fr-a1`). Un ensemble porte en
outre **`title`** (dans la langue source, ce que lit l'apprenant)
et **`title_native`** (dans la langue cible, comme second titre).

Les deux codes doivent être en ISO 639-1 (deux lettres), et
`source_language` doit être différent de `target_language`. Les
ensembles antérieurs à la v1.2 sans ces champs se chargent toujours :
l'ancienne clé `language` est acceptée comme `target_language`, et
`source_language` retombe sur `en`.

## Disposition des répertoires

L'arbre est organisé par LANGUE SOURCE, puis cible+niveau :

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

### Index de recherche (`search-index.json`)

La découverte et la recherche de contenu (la surface *Découvrir*)
sont pilotées par un `search-index.json` léger publié à la racine du
dépôt (~4 Ko, métadonnées seulement - aucun contenu de carte). Le
dépôt de contenu officiel le fournit, et l'app récupère les index de
chaque dépôt configuré côté client (compatible CORS, mis en cache
dans localStorage avec un TTL stale-while-revalidate de 24 h) afin
qu'un apprenant puisse TROUVER un ensemble avant de le télécharger.
Chaque entrée annonce les `id`, `name`, `description`,
`source_language` / `target_language`, `level`, `domain`,
`lesson_count`, `card_count`, `tags` de l'ensemble, un drapeau
`ai_validated`, un `trust_level`, un `book` compagnon optionnel et un
horodatage `updated_at`. Garde-le synchronisé avec les manifestes
d'ensemble ; une PR vers le dépôt officiel le régénère.

## Format du manifeste

Le schéma des champs du manifeste (le `manifest.yaml` racine qui
liste les ensembles du dépôt, et chaque champ obligatoire et
optionnel : `schema_version`, `name`, et par ensemble `id`, `title`,
`title_native`, `target_language`, `source_language`, `level`,
`version`, `lesson_count`, `path`, `domain`, `tags`, `book`,
`visibility`) vit dans la référence de l'engine :
[learn-content-engine, Manifest format](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md#manifest-format).
Le schéma strict de l'engine (les champs inconnus sont rejetés) le
valide, de sorte que la liste de champs ci-dessus ne peut pas
dériver. Rédige les champs de paire de langues
(`target_language` / `source_language`) comme décrit sous
[Paires de langues](#paires-de-langues-v1440) ; l'alias `language`
d'avant la v1.2 se charge encore mais est déconseillé pour les
nouveaux ensembles.

Le champ optionnel **`visibility`** (engine 0.14.0+, `visible` en
l'absence d'indication) est une **indication d'affichage** pour les
apps consommatrices : `visibility: hidden` demande à l'app de ne pas
présenter l'ensemble aux apprenants - pensé pour les fixtures de
référence / de conformité qui doivent rester dans le dépôt pour la
validation de l'engine mais ne sont pas du contenu d'apprentissage.
L'app filtre les ensembles masqués hors des surfaces de navigation
et de *Découvrir* (même quand ils sont déjà en cache) ; l'engine
continue de les valider. Il n'y a plus de liste d'ensembles masqués
côté app à maintenir.

Comportement spécifique au chargeur de l'app à garder à l'esprit :

- Le manifeste d'ensemble liste chaque fichier de leçon sous
  `metadata.lessons`, et le chargeur de contenu itère cette liste
  **dans l'ordre donné** : les noms de fichiers sur le disque sont
  sans importance, seul l'ordre du manifeste compte :

  ```yaml
  metadata:
    lessons:
      - 01-intro.json
      - 02-articles.json
      - ...
  ```

## Schéma de leçon

Chaque leçon est un unique fichier JSON : métadonnées de premier
niveau (`id`, `title`, `description`, `estimated_minutes`), une liste
de **cartes** (les plus petites unités apprenables - ids stables,
paires recto/verso, `notes` en Markdown, `tags` pour le SRS) et une
liste d'**étapes**, chacune étant soit une étape THEORY (un `body`
Markdown, éventuellement un lien `example_url` ou des `examples` en
ligne), soit une étape EXERCISE (exactement un exercice).

La référence de format complète, champ par champ - chaque champ,
chaque type d'exercice, chaque mode de cloze, avec des exemples JSON
validés par la suite de tests de l'engine - vit dans la **référence
de l'engine** :

- [learn-content-engine - `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
  - la référence canonique du format de leçon pour les auteur·rice·s
  et les validateurs tiers (aucun checkout de l'app nécessaire)
- le schéma lisible par machine livré avec chaque release de l'engine :
  `import schema from "learn-content-engine/schema/lesson.schema.json"`
- le jumeau intégré à l'app : la
  [Lesson format reference](lesson-format-reference.md) générée

Le schéma livré par l'engine est identique octet pour octet au
`schema/lesson.schema.json` généré de ce dépôt (imposé par
`make engine-parity-check`), de sorte que « valide contre l'engine »
et « valide dans l'app » sont la même affirmation.

## Quel type d'exercice pour quel objectif d'apprentissage

Choisis le type d'exercice selon l'**objectif d'apprentissage**, pas
pour la variété. La notation par correspondance exacte mot à mot - un
`word_tiles` de phrase entière, ou un `free_text` de phrase complète -
échoue pour la **production libre** : un concept peut se formuler de
bien des façons correctes, si bien qu'un apprenant au contenu juste se
voit marqué faux mot après mot. C'est le moment le plus démotivant
qu'une leçon rédigée puisse produire. Fais plutôt correspondre le type
à l'objectif :

| Objectif d'apprentissage | Bon type |
|---|---|
| Un fait avec une seule réponse | `cloze` (un trou) |
| Reconnaître un concept | choix multiple (`cloze` en mode `select`) / `matching` |
| Définir un concept | `cloze` avec des trous sur les termes clés |
| Explication libre / transfert / comparaison | pas encore de type à correspondance exacte - utilise `cloze` / choix multiple pour l'instant ; l'auto-évaluation est prévue |
| Phrase avec un seul ordre de mots non ambigu (apprentissage des langues) | `word_tiles` |

Règle empirique : réserve `word_tiles` aux phrases dont l'ordre des
mots est vraiment unique (un exercice de traduction), et rédige les
définitions et les faits en `cloze` (ou en choix multiple via le mode
`select` du `cloze`). Ne mets jamais une définition de forme libre
dans un `word_tiles` ou un `free_text` de phrase complète - il n'y a
pas de notation par correspondance exacte équitable pour cela. Analyse
complète : voir EXP-041
(`docs/explorations/EXP-041-aufgabentyp-eignung-und-faire-bewertung.md`).

## Catalogue des types d'exercices (statut)

Une seule référence de chaque type d'exercice : ce qui est livré, ce
qui est exprimable sans nouveau type, ce qui est candidat et ce qui
est délibérément exclu. Le modèle canonique n'est **pas** étendu sur
spéculation - un type n'est livré qu'avec son moteur de rendu (le
registre `SUPPORTED_EXERCISE_TYPES` doit être égal à l'énumération
`ExerciseType` ; un test de parité l'impose, la leçon tirée des cas
v1.4-preview / `picture_choice`). Les nouveaux types sont ajoutés sur
demande de contenu concrète via la recette
[Adding a new exercise type](adding-exercise-type.md).

### Implémentés (l'énumération `ExerciseType`)

| Type | Pour quoi (objectif d'apprentissage, EXP-041) | Remarque |
|------|-----------------------------------|------|
| `matching` | Reconnaître / associer des concepts | Association par glisser, ≥ 3 paires. |
| `picture_choice` | Reconnaître à partir d'une vraie **image** | ≥ 2 images, exactement une correcte. Pas pour un QCM textuel. |
| `free_text` | Produire une réponse courte, de forme factuelle | Correspondance exacte, puis Levenshtein ≤ 1. |
| `word_tiles` | Un ordre de mots non ambigu (langue) | Tuiles mélangées ; `accept_orderings` pour les variantes. |
| `cloze` (`type`) | Un fait avec une seule réponse | Un `<input>` par trou. |
| `cloze` (`select`) | Choix multiple simple (véhicule legacy) | Rendu en boutons cliquables (#1342). `accept[0]` correct + `distractors`. |
| `cloze` (`multiselect`) | « Sélectionne tout ce qui s'applique » (véhicule legacy) | Correspondance par ensemble exact sur `accept` (tous corrects) + `distractors` (#1195). |
| `multiple_choice` | **Choix multiple textuel natif** (schéma v1.6, #1525) | `options` (`{text, correct?}`, textes uniques) + `multiple`. Simple = exactement un correct ; multi = correspondance par ensemble exact, pas de points partiels. |

Depuis le schéma v1.6, il existe un type natif `multiple_choice`. Il
**coexiste** avec le véhicule `cloze` `select`/`multiselect`
(EXP-036 §4.3, #890) - le choix multiple basé sur cloze existant reste
valide, rien n'est déprécié. Préfère `multiple_choice` pour les
nouveaux contenus de QCM textuel : la justesse est un drapeau par
option, le piège de la disjonction accept/distractors ne peut donc pas
se produire. Voir [Créer des choix multiples](#creer-des-choix-multiples).

### Palier d'extension (l'espace de noms `ext:`)

Au-delà de l'énumération centrale fermée, il existe des types
d'exercices dans l'espace de noms `ext:<vendor>-<name>`. Ils sont
structurellement opaques pour le schéma central : une leçon qui les
utilise les déclare dans `requires_extensions`, et la charge utile est
validée par l'extension enregistrée, jamais par le schéma central. Le
mécanisme est décrit dans la référence de l'engine
[learn-content-engine - `docs/extensions.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/extensions.md).
L'app a adopté cinq types d'extension (`SUPPORTED_EXT_EXERCISE_TYPES`
dans l'`ExerciseDispatcher` ; une barrière de parité garde le
dispatcher et la garde de chargement synchronisés, de sorte que tout
ce qui est chargeable est affichable) :

| Type | Pour quoi | Charge utile (`ext_payload`) | Adopté |
|------|----------|-------------------------|---------|
| `ext:al-categorization` | Trier des termes en groupes | `categories: [{name, items[]}]`, au moins 2 seaux | #1591 (premier type d'extension, inventaire #1579) |
| `ext:al-error-correction` | Corriger un texte fautif | `tokens[]` + `error_index` + `accept[]` | #1593 |
| `ext:al-reading-comprehension` | Compréhension écrite (passage + questions) | `passage` + `questions[]` (chacune une sous-question `multiple_choice` / `free_text`) | #1603 |
| `ext:al-graded-quiz` | Quiz noté | `questions[]` (chacune avec `points`) + `pass_threshold` optionnel | #1616 ; l'ensemble de démo de référence est masqué de Découvrir / Mes contenus (#1702) |
| `ext:al-dictation` | Dictée audio (écouter, puis transcrire) | `audio` (un clip `assets/` ou un URI de données intégré via le téléversement de l'éditeur, #1911) + `accept[]` (correspondance de transcription tolérante) | #1881 (cinquième adoption) |

**Deux voies de rédaction.** Les exercices d'extension peuvent être
rédigés (a) directement en JSON de dépôt de contenu (la voie
canonique, décrite dans la référence de l'engine), ou (b) dans l'app.
Le créateur de leçons a reçu un **assistant de rédaction d'extensions**
(#1852), atteint depuis le modèle *Types d'exercices avancés* à
l'étape 1, qui couvre les cinq types (#1859 categorization +
error-correction, #1865 reading-comprehension + graded-quiz, #1887
dictation). La dictée est aussi accessible depuis le sélecteur de type
d'exercice central à l'étape 3, derrière une garde `requires_extensions`
généralisée (#1895). L'une comme l'autre voie émet le même JSON de
leçon et définit `requires_extensions` (versionné, p. ex.
`ext:al-dictation@1`).

#### Exemple par type d'extension

Chaque bloc est l'objet d'exercice tel qu'il apparaît dans un `.json`
de leçon ; les données propres au type vivent sous `ext_payload`. La
référence canonique des champs est le `docs/extensions.md` de l'engine.

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

### Disponibilité dans l'assistant de leçon

Jouable (un moteur de rendu existe), générable (le mélange IA peut le
produire) et ajoutable manuellement (tu en ajoutes et édites un à la
main à l'étape 3) sont trois choses différentes. Les six types
centraux sont tous jouables ET générables : le sélecteur de type dans
l'assistant de création de leçon (`ALL_TYPES` dans
`ExerciseGenerator.tsx`) propose chaque type central, et chaque
exercice de l'étape 3 est éditable en ligne et réordonnable, avec un
bouton manuel **+ Ajouter un exercice** (#1849, #1853).

| Type | Jouable | Générable (mélange IA) | Ajoutable manuellement (étape 3) |
|------|----------|----------------------|---------------------------|
| `matching` | oui | oui | oui |
| `free_text` | oui | oui | oui |
| `cloze` | oui | oui | oui |
| `word_tiles` | oui | oui | oui |
| `picture_choice` | oui | oui | oui |
| `multiple_choice` | oui | oui (#1853 ; contrôle du mode simple/multi #1888) | oui |
| `ext:al-dictation` | oui | non | oui, via le sélecteur central (#1895) ou l'assistant d'extension (#1887) |
| `ext:al-categorization` | oui | non | via l'assistant d'extension (#1859) |
| `ext:al-error-correction` | oui | non | via l'assistant d'extension (#1859) |
| `ext:al-reading-comprehension` | oui | non | via l'assistant d'extension (#1865) |
| `ext:al-graded-quiz` | oui | non | via l'assistant d'extension (#1865) |

Les quatre types d'extension autres que la dictée sont rédigés dans
l'assistant d'extension (ou en JSON de dépôt de contenu), jamais
mélangés dans la génération IA centrale.

**« Écouter d'abord » est un mode, pas un type.** Depuis #1687
(décision #1600, option A), les exercices `free_text` et `matching`
peuvent porter un élément audio-d'abord (écouter d'abord, puis
répondre). Le type de l'exercice ne change pas. L'option B de la même
décision, un type de dictée, a été livrée comme l'extension
`ext:al-dictation` (#1881), documentée dans le palier d'extension
ci-dessus.

### Le créateur de leçons comme outil de rédaction

Le créateur de leçons intégré à l'app (`/create-lesson`) est une
surface de rédaction complète, pas seulement un bouton de génération
IA :

- **Chaque exercice de l'étape 3 est éditable en place.** Chaque
  exercice généré ou ajouté s'ouvre dans un éditeur en ligne (les six
  types centraux, plus les éditeurs d'extension) ; réordonne par
  glisser, supprime, ou régénère tout le mélange (#1845).
- **Ajouter un exercice à la main.** Le bouton **+ Ajouter un
  exercice** choisit un type et ajoute un exercice vide directement
  dans l'éditeur en ligne, de sorte que tu peux rédiger sans aucune
  génération IA (#1849, #1853). Le sélecteur liste les six types
  centraux plus la dictée (#1895).
- **La phrase d'exemple pilote la génération.** Une carte (étape 2)
  peut porter une **phrase d'exemple** optionnelle. C'est ce qui
  permet la génération de `cloze` et de `word_tiles` pour cette carte
  (pour le cloze, la phrase doit contenir le terme recto de la carte
  afin qu'il puisse être masqué), et une image de carte permet le
  `picture_choice`. Sans eux, ces types sont silencieusement sautés,
  et l'étape 3 explique quel type sélectionné n'a rien produit (#1847,
  #1848).
- **Les invites générées suivent la langue de l'interface.** Les
  modèles d'instruction d'exercice sont localisés au moment de la
  génération (#1857), de sorte qu'un auteur sur une interface allemande
  obtient des invites allemandes, pas des valeurs par défaut anglaises.
  Quand tu ouvres une leçon plus ancienne pour l'éditer, toute invite
  d'exercice encore identique octet pour octet à une valeur anglaise
  legacy est migrée de manière opportuniste vers le modèle de la langue
  de l'interface (état d'édition seulement, persisté seulement si tu
  enregistres) (#1861).

### Exprimable sans nouveau type (conventions, pas des types)

| Concept | Comment |
|---------|-----|
| Vrai/Faux, Oui/Non | `multiple_choice` à deux options (ou un `cloze` `select` à deux options) |
| Liste déroulante / bouton radio / case à cocher | Présentation d'un `multiple_choice` / cloze select - pas des types distincts |

### Prévu si nécessaire (candidats - PAS un engagement)

| Candidat | Proche de | Quand |
|-----------|------|------|
| Ordonnancement / tri | `word_tiles` | Uniquement sur demande de contenu concrète, puis via la recette. |
| Champ numérique (comparaison numérique) | `free_text` | Uniquement sur demande de contenu concrète, puis via la recette. |

### Délibérément exclus

| Exclu | Pourquoi (une ligne) |
|----------|----------------|
| Dissertation / texte long / dessin / formule / évaluation par les pairs / auto-évaluation libre | Pas notable en binaire par le SRS ; auto-évaluation reportée (#1268). |
| Upload audio / vidéo / fichier | Stockage + infrastructure ; en conflit avec l'approche hors-ligne d'abord. Seule exception : les courts clips audio de dictée que l'éditeur d'exercices intègre dans la leçon sous forme d'URI de données. |
| Zone active / simulation / memory / mots croisés | Effort de construction sans valeur SRS (une décision ultérieure et distincte, un jour peut-être). |
| Matrice / Likert / curseur | Types de sondage, pas des types d'apprentissage. |
| Sélecteurs de date / heure | Types de formulaire, pas des types d'apprentissage. |

## Référence des types d'exercices

La référence des champs par type - `matching`, `picture_choice`,
`free_text`, `word_tiles`, `multiple_choice` et `cloze` avec ses modes
`type` / `select` / `multiselect` : champs obligatoires, exemples JSON
et règles sémantiques (marqueurs `___` du cloze == `blanks`, intégrité
référentielle des `card_ids`, disjonction accept/distractors du
multiselect, exactement-un-correct du picture-choice) - vit dans la
référence de l'engine :
[learn-content-engine - `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md).
Chaque exemple JSON qui s'y trouve est extrait et validé par la suite
de tests de l'engine, de sorte que la référence ne peut pas pourrir.
Les conventions de rédaction propres à l'app ci-dessous restent ici.

### Créer des choix multiples

**Préféré (schéma v1.6+, #1525) : le type natif `multiple_choice`.**
Les options portent leur propre drapeau `correct`, il n'y a donc pas
de listes accept/distractors séparées à garder disjointes.
`multiple: false` (par défaut) est le choix simple (exactement une
bonne réponse) ; `multiple: true` est « sélectionne tout ce qui
s'applique » (notation par ensemble exact, pas de points partiels) :

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

**Forme legacy (toujours pleinement valide - coexistence, rien de
déprécié) :** avant la v1.6, le QCM textuel s'écrivait comme `cloze`
en mode `select` (EXP-036 §4.3, #890). Une question à réponse unique
est un cloze à un trou : la `sentence` (se terminant par `___`) est la
question, l'`accept[0]` du trou est la bonne option et les
`distractors` sont les mauvaises options. Exemple :
`"sentence": "The capital of France is ___."`,
`"blanks": [{"accept": ["Paris"]}]`, `"cloze_mode": "select"`,
`"distractors": ["Berlin", "Madrid", "Rome"]`.

Tu peux aussi mettre toute la question dans `prompt` et utiliser un
simple `"sentence": "___"` - le moteur de rendu affiche un `<select>`
composé de la bonne réponse + des distracteurs, note le choix, donne
un retour et alimente le SRS :

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

> **N'écris jamais un choix multiple textuel comme `picture_choice`.**
> Ce type est réservé aux vraies ressources d'image ; avec des options
> textuelles, il rend des tuiles d'espace réservé, pas un contrôle
> utilisable (cf.
> astrapi69/adaptive-learner-content-test#10). Le QCM textuel, c'est
> `multiple_choice` (préféré) ou `cloze` en mode `select`, comme
> ci-dessus.

**« Sélectionne tout ce qui s'applique »** (deux bonnes réponses ou
plus, p. ex. une question d'examen du permis de conduire) utilise
`cloze_mode: "multiselect"` :

```json
{
  "type": "cloze",
  "cloze_mode": "multiselect",
  "sentence": "Which cities are in Germany?",
  "accept": ["Berlin", "Hamburg"],
  "distractors": ["Vienna", "Zurich"]
}
```

**Plusieurs trous par cloze** sont pris en charge : chaque `___` de
la phrase est mappé à tour de rôle sur l'entrée suivante de `blanks`.
Chaque trou peut avoir son propre indice + espace réservé + liste
d'acceptation. Le SRS d'éléments éclate par trou un ElementAttempt -
qui remplit le trou A couramment mais manque sans cesse le trou B
obtient un suivi de maîtrise au niveau du trou.

**Rôles de jeton sur les cartes (phase 52I / v1.35.0)** - métadonnées
de carte optionnelles avec lesquelles le générateur de cloze peut, à
l'exécution (sessions de révision + le tour de correction en fin de
leçon), choisir un trou sémantiquement significatif :

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

Énumération fermée de rôles : `article` / `verb` / `noun` /
`adjective` / `preposition` / `gender_marker` / `tense_marker`.
Ajouter un rôle est un bump de version mineure du schéma - ne
l'étends pas en ligne.

## Écritures non latines : convention de translittération

Règles contraignantes pour les ensembles dont la langue cible utilise
une écriture non latine (japonais, chinois, coréen, grec, hindi, ...).
Établies et appliquées dans le dépôt de contenu - précédents :
[content#90](https://github.com/astrapi69/adaptive-learner-content/issues/90),
[content#91](https://github.com/astrapi69/adaptive-learner-content/issues/91) ;
balayages des lacunes restantes :
[content#106](https://github.com/astrapi69/adaptive-learner-content/issues/106),
[content#107](https://github.com/astrapi69/adaptive-learner-content/issues/107).

**1. Règle de direction.** La translittération n'est que pour la
langue **cible** non latine quand la langue source écrit en écriture
latine (de→ja, de→zh, de→ko, ...). Une langue **source** non latine
avec une cible en écriture latine (hi→en, el→fr) ne reçoit pas de
translittération - l'apprenant lit déjà sa propre écriture.

**2. Format.** Parenthèses rondes directement après l'original :
こんにちは (konnichiwa). Dans les étapes de théorie toujours ; dans les
options et les invites, seulement là où c'est inoffensif (voir la
règle de non-trahison).

**3. Règle de non-trahison (le cœur).** La translittération ne doit
jamais livrer la solution. Les tâches de lecture d'écriture, la
reconnaissance de tons, les tuiles de `word_tiles` et les contextes de
phrase de cloze restent SANS translittération sur l'élément
interrogé ; les tâches de sens la reçoivent. Dans le doute, laisse-la
de côté.

- Exemple positif (association de sens, content#91) : la paire de
  matching `{"left": "妈 (mā)", "right": "Mama / Mutter"}` - la
  connaissance interrogée est le sens, l'aide à la lecture ne trahit
  donc rien.
- Exemple négatif (lecture d'écriture, content#91) : les exercices de
  lecture d'écriture `ko-a1/01-hangul-lesen` restent sans
  translittération, car la romanisation EST la réponse
  (caractère → son) ; `가 (ga)` dans l'invite donnerait la solution à
  l'apprenant.

**4. Romanisation standard par langue, cohérente au sein d'un
ensemble :** japonais Hepburn, chinois Pinyin AVEC marques de ton,
coréen Revised Romanization, grec/hindi une translittération
simplifiée courante. Ne mélange jamais les systèmes dans un même
ensemble.

**5. Tâches de saisie** (`free_text` / cloze en mode `type`) :
`accept[0]` est la forme romanisée canonique ; accepte en plus les
variantes courantes - japonais : orthographes Kunrei
(si/ti/tu/hu/zi, p. ex. `konnitiwa` à côté de `konnichiwa`) ;
chinois : Pinyin sans tons (`nihao` à côté de `nǐ hǎo`) ; coréen :
alternatives répandues (p. ex. `annyeong haseyo`). Aide-mémoire :
**un exercice ne doit jamais échouer sur le clavier de l'apprenant.**
Précédent (blocage IME, content#107) : un cloze qui n'acceptait que
가 était insoluble sans IME coréen - le `ga` romanisé devait aussi
être accepté.

Quel type porte quel objectif d'apprentissage : voir le
[catalogue des types d'exercices](#catalogue-des-types-dexercices-statut).

## Direction d'exercice (v1.46.0 / EXP-018)

Chaque exercice accepte un champ optionnel `direction`, qui indique
dans quel sens les apprenants pratiquent la carte :

- `target_to_source` (par défaut) - RÉCEPTIF : la langue cible est
  montrée, la langue source est reconnue (plus facile).
- `source_to_target` - PRODUCTIF : la langue source est montrée, la
  langue cible est produite (plus difficile).
- `both` / `random` - laisse le moteur de rendu / le générateur
  adaptatif choisir une direction concrète par tentative.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

Le champ est additif - le schéma reste en version 1.2, et les
leçons sans `direction` se comportent exactement comme avant
(réceptif). Le SRS suit la maîtrise par direction : une carte
maîtrisée en réceptif n'est pas encore maîtrisée en productif. Les
exercices cloze sont liés au contexte et ignorent `direction`. Pour
une progression de difficulté, on garde les premières leçons en
réceptif et on introduit `source_to_target` dans les leçons
ultérieures (c'est exactement ce que fait le contenu pilote
empaqueté).

### Annotations pour le générateur de leçons adaptatif (v1.36.0+)

Le générateur de leçons adaptatif de la phase 53
(`/adaptive-lesson/:setId`, F-114) recombine les exercices
existants pour adresser de manière ciblée les faiblesses
spécifiques des apprenants. Le générateur fonctionne sans
annotations supplémentaires, mais deux champs le rendent nettement
plus intelligent :

1. **Une couverture `token_roles` plus large sur les cartes.** Le
   générateur utilise `token_roles` pour :
   - Choisir des trous sémantiquement pertinents lorsqu'il crée des
     variantes de cloze à partir d'erreurs (déjà présent en
     v1.35.0)
   - Classer les erreurs comme `article_gender` / `verb_conjugation`,
     pour les puces « point fort d'exercice » du tableau de bord
     (53E)
   - Trouver des exercices ALTERNATIFS qui testent le même élément
     lorsque l'exercice d'origine était faux (logique de variation
     53D - trouve les candidats dont la carte a une entrée
     `token_roles` correspondante)

   Ajoute à CHAQUE carte qui enseigne une unité grammaticale propre
   (article, formes verbales conjuguées, substantifs liés au genre)
   une entrée `token_roles`. Coût : une entrée JSON supplémentaire
   par carte ; bénéfice : une génération adaptative nettement plus
   riche.

2. **Les tags de carte comme `tags: ["article", "masculine"]`**
   sont lus par le classificateur d'erreurs comme repli quand
   `token_roles` manque. Ils ne remplacent pas `token_roles` - ils
   sont une annotation économique à mi-chemin.

Ce dont nous n'avons PAS encore besoin (reporté à un futur bump de
schéma) :

- Des renvois croisés `related_cards` entre cartes de leçons
  différentes
- Des notations de difficulté par exercice (le générateur estime
  actuellement la difficulté à partir de `exercise.type`)
- Des phrases d'exemple par carte dans `notes`, analysables comme
  contextes de cloze alternatifs (le générateur de cloze utilise
  exclusivement `front`)

Règle empirique : ajoute `token_roles` à chaque carte qui enseigne
un jeton grammatical. C'est de loin l'habitude d'auteur la plus
efficace pour le système adaptatif.

## Ressources (images qu'un ensemble apporte) - v1.37.0+

Les exercices picture-choice et les images de couverture de carte
proviennent de deux sources :
1. **Fichiers de ressources d'auteur**, déclarés dans le manifeste
   d'ensemble et livrés à côté du JSON de leçon
2. **SVG d'espace réservé**, générés par le runtime quand aucune
   ressource n'existe (tablettes de couleur pour les mots de
   couleur, grands chiffres pour les nombres, style avatar pour
   tout le reste)

Si tu publies un ensemble sans ressources, picture-choice
fonctionne quand même - le générateur de SVG d'espace réservé
couvre automatiquement les couleurs + les nombres et retombe pour
tout le reste sur un avatar déterministe.

### Disposition des répertoires

À l'intérieur du répertoire d'ensemble, les ressources se trouvent
sous `assets/` :

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

### Déclaration dans le manifeste

Chaque ressource doit être déclarée dans le manifeste d'ensemble,
afin que le téléchargeur sache ce qu'il doit récupérer :

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

Le `path` est relatif au répertoire `assets/` de l'ensemble (PAS au
JSON de leçon). Dans le JSON de leçon, les exercices picture-choice
référencent les ressources AVEC le préfixe `assets/` :

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

Le frontend retire automatiquement le préfixe `assets/` lors de
l'appel du résolveur de ressources, de sorte que le JSON de leçon
reste sous la forme intuitive pour les auteur·rice·s.

### Limites de taille + de format

- **Limite par ressource** : 500 KiB. Le validateur de manifeste
  rejette les ressources dont la `size_kb` déclarée dépasse cette
  limite. Le téléchargeur rejette aussi les ressources dont la
  taille réelle en octets dépasse la déclaration de plus de 10 % -
  cela maintient le manifeste honnête.
- **Limite souple par ensemble** : 10 MiB de taille totale. Le
  validateur avertit, mais ne rejette pas.
- **Formats acceptés** : `.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`. Pas de GIF (le contenu animé distrait), pas de BMP (pas
  de compression). Pour les photos, privilégie WebP - nettement
  plus petit que PNG à qualité comparable. Pour les icônes +
  diagrammes, privilégie SVG - il s'adapte proprement + taille de
  fichier minuscule.

### Recommandations de taille

Les tuiles picture-choice sont rendues jusqu'à un maximum de
150x150 px sur le bureau et 100x100 px sur mobile (`object-fit:
contain`). Des images sources de 300x300 px donnent le meilleur
résultat sur les écrans Retina sans besoin de données inutile. Les
PNG de plus de 150 KiB sont rarement plus beaux qu'un WebP bien
compressé de moitié de taille.

### Quand l'espace réservé du runtime suffit

Trois types de leçons pour lesquels l'espace réservé du runtime est
si bon que des images d'auteur n'apportent aucun gain
d'apprentissage :

- **Leçons de couleur** (`rouge` / `rojo` / `rot` / `red`) : le
  générateur d'espace réservé crée une tuile hexadécimale colorée
  correspondant au nom de la couleur. Les tuiles d'auteur sont
  redondantes.
- **Leçons de nombres** (`7` / `42` / `1492`) : l'espace réservé
  affiche les chiffres en grand + centrés. Des images d'auteur
  n'auraient de sens que pour des systèmes de chiffres non arabes.
- **Concepts abstraits** sans représentation visuelle évidente
  (`patience`, `liberté`) : l'espace réservé avatar fournit un
  ancrage visuel clair sans imposer un choix d'icône discutable.

Pour tout le reste (animaux, objets, nourriture, lieux, parties du
corps), les images d'auteur aident de manière mesurable à la
reconnaissance + à la mémorisation.

## Liste de contrôle qualité

Avant la PR d'une nouvelle leçon, vérifie :

- [ ] **3-5 étapes de théorie** + **8-12 exercices** par leçon
- [ ] **Au moins 3 types d'exercices** représentés (matching, picture-choice, free-text, word-tiles ou cloze - cloze à partir de la v1.35.0)
- [ ] **Étapes de théorie ≤ 200 mots** par étape
- [ ] **Exercices de texte libre** : ≥ 3 variantes d'acceptation + ≥ 3 distracteurs
- [ ] **Word-tiles** : ≥ 3 tuiles par exercice
- [ ] **estimated_minutes** : 10-15 (réaliste, pas idéalisé)
- [ ] **Les distracteurs sont faux mais plausibles** - sémantiquement liés, jamais aléatoires
- [ ] **Les notes de carte** apportent une réelle plus-value (prononciation, faux amis, marqueur d'exception)
- [ ] **Structure progressive** : les concepts ultérieurs s'appuient sur les précédents dans le même ensemble
- [ ] **Exactitude culturelle** : usage réel de la langue, pas seulement des tournures de manuel
- [ ] **Validation de schéma** : la leçon se charge proprement via `dict_to_lesson()` (voir Tests locaux)
- [ ] **Intégrité des ID de carte** : chaque `exercise.card_ids[i]` existe dans `cards[]` de la leçon
- [ ] **Paire de langues** : `target_language` + `source_language` définis (ISO 639-1, différents), `title_native` présent

## Validation (deux niveaux, v1.44.0)

Les contenus sont sécurisés par deux niveaux de validation avec les
MÊMES vérifications :

1. **Dans l'application, avant le partage.** Lors du partage via
   *Mes leçons → Mettre à disposition de la communauté*, une
   vérification basée sur des règles s'exécute d'abord (toujours,
   sans IA). Elle impose les **valeurs minimales** ci-dessous ; un
   ensemble en dessous ne peut pas être partagé. S'il passe et
   qu'une clé IA est configurée, l'apprenant peut OPTIONNELLEMENT
   lancer une vérification IA complémentaire (exactitude de la
   traduction, plausibilité des distracteurs, grammaire, niveau,
   sensibilité culturelle, naturel). L'étape IA n'est jamais
   automatique, exige un consentement explicite (le contenu de la
   leçon est envoyé au fournisseur configuré) et ne bloque jamais
   le partage - la vérification basée sur des règles est le verrou.
2. **Dans la CI du dépôt de contenu.** Une pull request vers
   `astrapi69/adaptive-learner-content` exécute son propre
   `scripts/validate_content.py` (structure contre le miroir de
   schéma vendorisé et épinglé à l'engine + valeurs minimales de
   qualité) plus une barrière de conformité à l'engine
   (`learn-content-engine` `validate()` sur chaque leçon), de sorte
   qu'une PR manuelle ne peut pas contourner le verrou.

**Valeurs minimales de qualité (verrou strict) :** ≥ 5 exercices
par leçon, ≥ 2 types d'exercices, ≥ 1 étape de théorie, texte libre
≥ 2 réponses acceptées + distracteurs, matching ≥ 3 paires,
picture-choice avec distracteurs, aucun recto/verso de carte vide
et (pour les écritures sources non latines) des versos de carte
dans l'écriture source. Ce sont des valeurs minimales, pas des
objectifs - la liste de contrôle ci-dessus en exige davantage.

### Vérification IA de l'ensemble (optionnelle)

En plus de la vérification au moment du partage, un ensemble
téléchargé peut être passé en revue à l'échelle de l'ensemble via
*Vérifier avec l'IA*. C'est entièrement optionnel et cela utilise le
**fournisseur + modèle** que l'apprenant a configurés (Anthropic /
OpenAI / Gemini) ; les cartes sont envoyées par lots à ce fournisseur
pour examen. Le flux affiche une estimation de coût, s'exécute avec
une barre de progression + annulation, et produit un **rapport par
carte** qui est mis en cache dans le navigateur et peut être exporté
en **Markdown** (avec une ligne indiquant quel fournisseur + modèle a
effectué la vérification). Quand le rapport passe, l'ensemble gagne un
**badge « Vérifié par l'IA »** adossé à un hash de contenu + une
signature, de sorte qu'une édition ultérieure des cartes invalide le
badge jusqu'à ce que l'ensemble soit revérifié. La vérification IA
n'est jamais un verrou - c'est une provenance consultative, pas une
exigence de publication.

## Tests locaux

Le validateur de schéma du chargeur de contenu s'exécute dans le
cadre de `make test`. Valider une leçon unique à la main :

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} - {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

Valider toutes les leçons d'un dépôt de contenu d'un coup - avec le
validateur du dépôt de contenu (le même script que sa CI exécute à
chaque PR) :

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

Il trouve chaque ensemble sous `sets/{source}/{target-level}/` et
vérifie le schéma plus les valeurs minimales de qualité (≥5
exercices, ≥2 types d'exercices, ≥1 étape de théorie, acceptations
de texte libre + distracteurs, paires de matching, aucune carte
vide, intégrité des ID de carte). Les nouvelles leçons sont
détectées automatiquement - aucune modification de test nécessaire.

## Flux de travail des PR

Dès que ton ensemble est prêt :

1. Ouvre une PR contre le dépôt principal (pour les ensembles
   destinés à être livrés avec l'application), OU
2. Crée ton propre dépôt de contenu sous ton compte GitHub et
   configure le chargeur de contenu via
   `backend/config/plugins/content-loader.yaml` (sous
   `default_sources`).

Le chargeur de contenu prend en charge tout dépôt GitHub public
comme source. Les dépôts privés nécessitent un Personal Access
Token, défini via la gestion de clés à trois couches
(`~/.config/adaptive_learner/secrets.yaml`).

## Pièges fréquents

**Références d'ID de carte** : chaque entrée `card_ids` d'un
exercice doit exister dans `cards[]` de la leçon. Si tu copies un
exercice entre leçons et oublies d'emporter la carte associée, la
validation échoue.

**ID slug-sûrs** : tous les ID (Lesson, Card, Step, Exercise)
doivent correspondre à `^[a-z0-9]+(-[a-z0-9]+)*$`. Pas de tirets
bas, pas d'apostrophes, pas de majuscules, pas de tirets en
début/fin.

**`is_correct: "true"`** : c'est une chaîne, pas un booléen JSON.
Le schéma exige explicitement `"true"`, car les champs
picture_choice sont modélisés en interne comme dict[str, str].

**Champs supplémentaires** : chaque modèle a `extra="forbid"`. Un
champ non documenté entraîne le rejet de toute la leçon. Tiens-t'en
aux champs documentés.

**Corps de théorie** : les étapes de théorie nécessitent un champ
`body` non vide (Markdown). Les étapes d'exercice ne doivent pas
porter de `body` - utilise plutôt le `prompt` de l'exercice.

## Référence : les ensembles livrés

Adaptive Learner livre une bibliothèque conséquente couvrant
plusieurs domaines (langues, programmation, psychologie, IA,
technologie - voir le bloc CONTENT-STATS du README pour les chiffres
en direct + le tableau complet par ensemble). Quelques bonnes
références canoniques dans le dépôt `adaptive-learner-content` :

- `sets/en/fr-a1/` - Français A1 pour anglophones ;
  `sets/de/fr-a1/` est la contrepartie à source germanophone.
- `sets/en/es-a1/` + `sets/de/es-a1/` - Espagnol A1 (un par langue
  source).
- L'ensemble « Python - Grundlagen » sous `sets/de/` est un exemple
  `domain: programming` (source allemande == cible), utile comme
  référence non linguistique.

Ils suivent tous les conventions décrites dans ce guide. Lire une
leçon complète est le moyen le plus rapide d'intérioriser la
structure.

---

## Voie de participation communautaire (v1.42.0)

> **Guide pas à pas avec captures d'écran :**
> [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f)
> (Medium) parcourt de bout en bout le créateur de leçons intégré à
> l'app, de la première carte au partage de la leçon terminée.

Tu n'as pas besoin de créer les leçons à la main à partir de zéro.
Le moyen le plus rapide de contribuer est de **créer et partager
une leçon dans l'application** :

1. Importe un chat et analyse-le, puis **Enregistrer comme leçon
   hors ligne** (ou termine une leçon adaptative et **Enregistrer
   cette leçon ?**). La leçon apparaît sous **Mes leçons** dans le
   navigateur d'ensembles.
2. Dans « Mes leçons », clique sur **Exporter comme ensemble de
   contenu** pour télécharger un ensemble de contenu en `.zip`
   (manifeste + leçons). Les exports ne contiennent que le contenu
   de la leçon - aucune progression, aucun historique d'erreurs,
   rien de personnel.
3. Clique sur **Mettre à disposition de la communauté** pour ouvrir
   une **pull request** pré-remplie dans le dépôt de contenu - le
   JSON de leçon est committé au bon chemin dans l'arbre, sans
   pièce jointe `.zip` nécessaire.
4. La CI du dépôt valide automatiquement la PR ; un mainteneur
   vérifie la leçon, met le manifeste (id, title, language, level,
   tags) en accord avec les conventions ci-dessus et le fusionne
   sous `sets/`. Après le merge, tout le monde peut la télécharger
   depuis le navigateur d'ensembles.

C'est la voie sociale : la vérification est **manuelle** (un
mainteneur cure chaque ajout - rien n'est publié automatiquement),
et tout le déroulement ne nécessite que GitHub. Les leçons générées
sont déjà validées contre le schéma, de sorte qu'une leçon
contribuée ne nécessite généralement qu'un peu de peaufinage du
manifeste.

## Assistant de partage, variations et crédit d'auteur (phase 64)

Partager une leçon depuis **Mes leçons** ouvre un assistant en
quatre étapes, au lieu de sauter directement vers GitHub :

1. **Aperçu + placement.** L'application calcule exactement où la
   leçon atterrit dans l'arbre (`sets/{source}/{cible}-{niveau}/`)
   et un nom de fichier numéroté automatiquement
   (`{nn}-{slug}.json`, le numéro suivant après les leçons
   existantes). Une paire + un niveau entièrement nouveaux affichent
   *« Nouvel ensemble ! Tu es le premier. »*
2. **Vérification des doublons.** La leçon est comparée aux leçons
   déjà présentes dans ce chemin (chevauchement de cartes et
   d'exercices - consultatif, jamais bloquant). Si quelque chose de
   similaire existe, tu peux :
   - **Partager comme variation** - la leçon est marquée avec
     `variation_of: "{original_id}"` plus une `variation_note`
     optionnelle (« En quoi ta version diffère-t-elle ? »).
   - **Ne proposer que les nouveaux exercices** (pour les
     quasi-doublons) - l'assistant extrait exactement les exercices
     qui manquent à l'original, avec les cartes associées, comme
     variation complémentaire.
3. **Récapitulatif de qualité.** Les constats du validateur basé
   sur des règles (plus la vérification IA optionnelle) ; les
   avertissements sont affichés, mais ne bloquent jamais.
4. **Partager + célébrer.** Un clic ouvre la pull request GitHub
   (éditeur de fichier pour les petites leçons, page d'upload pour
   les grandes), et l'application te remercie par une petite
   célébration.

### Champs de variation et de crédit (schéma 1.3, tous optionnels)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Mehr Übungen zur Angleichung",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

Les quatre sont additifs et optionnels ; les leçons sans eux se
comportent exactement comme avant. `contributed_by` est défini si
l'auteur active le crédit lors du partage (un champ *« Ton nom
(optionnel) »*, mémorisé localement pour la prochaine fois). S'il
est présent, le lecteur affiche une ligne discrète *« Mis à
disposition par {name} »* sous le titre, et le texte de la pull
request liste l'auteur dans son tableau de métadonnées.

### Historique des contributions et lacunes

Les leçons partagées sont mémorisées localement (aucun compte
nécessaire) sous **Mes contributions** avec un compteur et une
distinction de *Contributeur communautaire* à partir de cinq leçons
partagées. Le navigateur d'ensembles affiche en outre **Leçons
manquantes** - des suggestions encourageantes pour le niveau CEFR
suivant d'une paire existante ou une langue cible qui existe pour
une langue source mais manque pour une autre (« Peux-tu aider ? »).

---

## Pages connexes

- [Créer des leçons - aperçu](../content-creation/overview.md) - entrée en matière + créateur de leçons dans l'application
- [Recommandations de livres](../content-creation/books.md) - gérer `books.yaml` par domaine
- [Plusieurs dépôts de contenu](../features/content-repos.md) - connecter son propre dépôt
- [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f) - parcours externe Medium avec captures d'écran
