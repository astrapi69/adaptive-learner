# Créer des contenus de leçon

Ce guide décrit pas à pas comment mettre en place un nouvel
ensemble de leçons pour le chargeur de contenu d'Adaptive Learner.
Qui veut construire un ensemble linguistique ou thématique — pour
son propre usage ou comme contribution au pool de contenu public —
devrait le lire entièrement une fois avant la première leçon.

## Qu'est-ce qu'un ensemble de contenu ?

Un **ensemble de contenu** est un paquet versionné de leçons qu'un
utilisateur peut télécharger via la page du navigateur d'ensembles
(`/content`). Le plugin de chargeur de contenu (v1.27.0) prend en
charge la découverte, le téléchargement, la mise en cache et la
comparaison de versions dans les deux modes de stockage.

Un ensemble a trois niveaux :

1. **Manifeste racine** (`manifest.yaml`) — liste chaque ensemble
   du dépôt. Lu par le navigateur d'ensembles pour le catalogue de
   sources.
2. **Manifeste d'ensemble** (`sets/{set-id}/manifest.yaml`) —
   sœur du manifeste racine, liste les fichiers de leçon de
   l'ensemble concret.
3. **Fichiers de leçon** (`sets/{set-id}/lessons/NN-slug.json`) —
   un fichier JSON par leçon, validé à chaque téléchargement contre
   le schéma de leçon (voir *Le schéma est la source de vérité
   unique* ci-dessous).

Les ensembles pilotes livrés avec Adaptive Learner se trouvent dans
le dépôt de contenu séparé
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(extrait comme checkout frère `../adaptive-learner-content` et
empaqueté par le build via
`frontend/scripts/copy-bundled-content.mjs`) et constituent de bons
modèles.

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
  *Lesson format reference* sont eux aussi générés (**ne les édite
  pas à la main**) ; ils suivent le miroir de l'engine, relance donc
  le générateur après chaque re-pin.

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

- **`target_language`** — ce que l'apprenant APPREND (p. ex.
  `fr`).
- **`source_language`** — ce que l'apprenant PARLE déjà, donc la
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
mon-content-repo/
  manifest.yaml               # Racine : liste chaque ensemble (avec path + paire)
  sets/
    de/                       # Langue source : allemand
      fr-a1/                  # Cible français, niveau A1  -> ID fr-a1-from-de
        manifest.yaml         # Ensemble : liste les leçons
        lessons/
          01-begruessung.json
          ...
        assets/               # images / audio optionnels
    en/                       # Langue source : anglais
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

## Format du manifeste

Les deux fichiers de manifeste (racine + ensemble) utilisent la
même forme avec `schema_version: '1.0'`. Champs obligatoires :

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

Le manifeste d'ensemble liste en plus chaque fichier de leçon :

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

Le chargeur de contenu itère sur `metadata.lessons` dans l'ordre
donné ; les noms de fichiers sur le disque sont sans importance —
seul l'ordre du manifeste compte.

## Schéma de leçon (v1.0)

Chaque leçon est un unique fichier JSON. Structure de premier
niveau :

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

### Cartes

Une carte est la plus petite unité apprenable — typiquement un
terme ou un concept unique. Chaque carte a un id stable
(référencé depuis les exercices) et une paire recto/verso
(front/back) :

```json
{
  "id": "art-le",
  "front": "le",
  "back": "der (männlich Singular)",
  "notes": "Vor konsonantenanfangenden männlichen Substantiven. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

`notes` accepte du Markdown. Utilise-le pour les règles de
prononciation, les avertissements sur les faux amis, les remarques
d'exception — tout ce qui améliore la mémorisation à long terme.
`tags` pilote le filtrage SRS.

### Étapes

Une leçon est une séquence pas à pas, chaque étape étant soit
THEORY (un bloc Markdown), soit EXERCISE (l'un des types
d'exercices) :

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Warum Artikel wichtig sind",
  "body": "# Artikel im Französischen\n\nJedes französische Nomen hat ein Geschlecht..."
}
```

Une étape de théorie peut porter en option un **lien d'exemple**
(schéma v1.4, additif — les leçons existantes restent valides sans
lui). Si présent, le lecteur affiche en dessous un bouton pour
ouvrir l'exemple :

```json
{
  "id": "intro",
  "type": "theory",
  "body": "Die Korrelation misst den Zusammenhang...",
  "example_url": "https://example.com/correlation-visualizer",
  "example_label": "Interaktive Visualisierung"
}
```

- `example_url` (optionnel) : doit être une URL `http(s)`.
- `example_label` (optionnel) : le texte du lien ; vide devient un
  « Voir l'exemple » localisé.

Ou un exercice :

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

## Référence des types d'exercices

### matching

Exercice d'association par glisser-déposer. Le moteur de rendu
mélange avant l'affichage.

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

Chaque paire doit avoir exactement deux clés : `left` + `right`.

### picture_choice

Choix multiple avec des images. ≥ 2 images, exactement une marquée
comme correcte.

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

Important : `is_correct` est une **chaîne** `"true"`, pas un booléen
JSON.

Si le chemin `src` pointe vers un fichier inexistant, le moteur de
rendu retombe sur le `label` — picture_choice fonctionne donc aussi
sans ressources d'illustration.

> **N'écris jamais un choix multiple textuel comme
> `picture_choice`.** Ce type est réservé aux vraies ressources
> d'image ; avec des options textuelles, il rend des tuiles d'espace
> réservé, pas un contrôle utilisable (cf.
> astrapi69/adaptive-learner-content-test#10). Le choix multiple
> textuel, c'est `multiple_choice` (préféré) ou `cloze` en mode
> `select` ; voir la section cloze ci-dessous.

### free_text

Saisir la réponse au clavier. Le moteur de rendu fait d'abord une
correspondance exacte, puis tolérante à Levenshtein.

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

`accept[0]` est la réponse canonique affichée en cas de mauvaise
tentative. Liste ≥ 3 variantes pour couvrir la casse + la
ponctuation ; les espaces sont normalisés par le moteur de rendu.

### word_tiles

Mettre des tuiles dans le bon ordre. Le moteur de rendu mélange
avant l'affichage.

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

Si plusieurs ordres de mots sont corrects, ajoute
`accept_orderings` :

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Chaque ordre est une permutation des indices de tuiles.

### cloze (phase 52 / v1.35.0 — schéma 1.1)

Texte à trous avec des marqueurs `___` visibles dans la phrase.
Chaque `___` correspond à une entrée de `blanks[]` (correspondance
de gauche à droite ; le chargeur vérifie
`sentence.count("___") == len(blanks)`).

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

**Modes de rendu** — définis par exercice via `cloze_mode` :

- `"type"` (par défaut si non défini) : un `<input>` par trou.
  Validé avec le même correspondance NFC + Levenshtein ≤ 1 que le
  texte libre, de sorte que les auteur·rice·s n'ont qu'à lister les
  variantes sémantiques (pas les fautes de frappe).
- `"select"` : un `<select>` par trou. Les options proviennent de
  `accept[0]` + des `distractors` de l'exercice, mélangées par trou
  avec une graine stable. **Nécessite des `distractors` non
  vides** — le validateur de schéma rejette `cloze_mode: "select"`
  sans eux.

**Choix multiple : depuis le schéma v1.6, il existe un type natif
`multiple_choice`.** Il **coexiste** avec la forme `cloze`
`select`/`multiselect` (EXP-036 §4.3, #890) : le choix multiple basé
sur cloze existant reste valide, rien n'est déprécié. Préfère
`multiple_choice` pour les nouveaux contenus de choix multiple
textuel : la justesse est un drapeau par option, le piège de la
disjonction accept/distractors ne peut donc pas se produire.
Vrai/Faux et Oui/Non n'ont pas non plus besoin d'un type propre : un
`multiple_choice` à deux options (ou un `cloze` `select` à deux
options) les couvre.

**Préféré (schéma v1.6+, #1525) : le type natif `multiple_choice`.**
Chaque option porte son propre drapeau `correct`, il n'y a donc pas
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

**Forme legacy (toujours pleinement valide : coexistence, rien de
déprécié) :** avant la v1.6, le choix multiple textuel s'écrivait
comme `cloze` en mode `select` (EXP-036 §4.3, #890). Une question à
réponse unique est un cloze à un trou : la `sentence` (se terminant
par `___`) est la question, l'`accept[0]` du trou est la bonne option
et les `distractors` sont les mauvaises options. Exemple :
`"sentence": "The capital of France is ___."`,
`"blanks": [{"accept": ["Paris"]}]`, `"cloze_mode": "select"`,
`"distractors": ["Berlin", "Madrid", "Rome"]`.

Tu peux aussi mettre toute la question dans `prompt` et utiliser un
simple `"sentence": "___"` ; le moteur de rendu affiche un `<select>`
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

**« Sélectionne tout ce qui s'applique »** (deux bonnes réponses ou
plus, p. ex. une question d'examen du permis de conduire) utilise
`cloze_mode: "multiselect"` (correspondance par ensemble exact sur
`accept` + `distractors`, #1195) :

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
la phrase est mappé à tour de rôle sur l'entrée suivante de
`blanks`. Chaque trou peut avoir son propre indice + espace
réservé + liste d'acceptation. Le SRS d'éléments éclate par trou un
ElementAttempt — qui remplit le trou A couramment mais manque sans
cesse le trou B obtient un suivi de maîtrise au niveau du trou.

**Rôles de jeton sur les cartes (phase 52I / v1.35.0)** —
métadonnées de carte optionnelles avec lesquelles le générateur de
cloze peut, à l'exécution (sessions de révision + le tour de
correction en fin de leçon), choisir un trou sémantiquement
significatif :

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
Ajouter un rôle est un bump de version mineure du schéma — ne
l'étends pas en ligne.

## Direction d'exercice (v1.46.0 / EXP-018)

Chaque exercice accepte un champ optionnel `direction`, qui indique
dans quel sens les apprenants pratiquent la carte :

- `target_to_source` (par défaut) — RÉCEPTIF : la langue cible est
  montrée, la langue source est reconnue (plus facile).
- `source_to_target` — PRODUCTIF : la langue source est montrée, la
  langue cible est produite (plus difficile).
- `both` / `random` — laisse le moteur de rendu / le générateur
  adaptatif choisir une direction concrète par tentative.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

Le champ est additif — le schéma reste en version 1.2, et les
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
     53D — trouve les candidats dont la carte a une entrée
     `token_roles` correspondante)

   Ajoute à CHAQUE carte qui enseigne une unité grammaticale propre
   (article, formes verbales conjuguées, substantifs liés au genre)
   une entrée `token_roles`. Coût : une entrée JSON supplémentaire
   par carte ; bénéfice : une génération adaptative nettement plus
   riche.

2. **Les tags de carte comme `tags: ["article", "masculine"]`**
   sont lus par le classificateur d'erreurs comme repli quand
   `token_roles` manque. Ils ne remplacent pas `token_roles` — ils
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

## Ressources (images qu'un ensemble apporte) — v1.37.0+

Les exercices picture-choice et les images de couverture de carte
proviennent de deux sources :
1. **Fichiers de ressources d'auteur**, déclarés dans le manifeste
   d'ensemble et livrés à côté du JSON de leçon
2. **SVG d'espace réservé**, générés par le runtime quand aucune
   ressource n'existe (tablettes de couleur pour les mots de
   couleur, grands chiffres pour les nombres, style avatar pour
   tout le reste)

Si tu publies un ensemble sans ressources, picture-choice
fonctionne quand même — le générateur de SVG d'espace réservé
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
  taille réelle en octets dépasse la déclaration de plus de 10 % —
  cela maintient le manifeste honnête.
- **Limite souple par ensemble** : 10 MiB de taille totale. Le
  validateur avertit, mais ne rejette pas.
- **Formats acceptés** : `.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`. Pas de GIF (le contenu animé distrait), pas de BMP (pas
  de compression). Pour les photos, privilégie WebP — nettement
  plus petit que PNG à qualité comparable. Pour les icônes +
  diagrammes, privilégie SVG — il s'adapte proprement + taille de
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
- [ ] **Au moins 3 types d'exercices** représentés (matching, picture-choice, free-text, word-tiles ou cloze — cloze à partir de la v1.35.0)
- [ ] **Étapes de théorie ≤ 200 mots** par étape
- [ ] **Exercices de texte libre** : ≥ 3 variantes d'acceptation + ≥ 3 distracteurs
- [ ] **Word-tiles** : ≥ 3 tuiles par exercice
- [ ] **estimated_minutes** : 10-15 (réaliste, pas idéalisé)
- [ ] **Les distracteurs sont faux mais plausibles** — sémantiquement liés, jamais aléatoires
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
   le partage — la vérification basée sur des règles est le verrou.
2. **Dans la CI du dépôt de contenu.** Une pull request vers
   `astrapi69/adaptive-learner-content` exécute
   `scripts/validate_content.py` (reflété sous
   `docs/ci/adaptive-learner-content/`) et vérifie chaque ensemble
   avec les mêmes règles, afin qu'une PR manuelle ne contourne pas
   le verrou.

**Valeurs minimales de qualité (verrou strict) :** ≥ 5 exercices
par leçon, ≥ 2 types d'exercices, ≥ 1 étape de théorie, texte libre
≥ 2 réponses acceptées + distracteurs, matching ≥ 3 paires,
picture-choice avec distracteurs, aucun recto/verso de carte vide
et (pour les écritures sources non latines) des versos de carte
dans l'écriture source. Ce sont des valeurs minimales, pas des
objectifs — la liste de contrôle ci-dessus en exige davantage.

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
print(f'OK: {lesson.id} — {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

Valider toutes les leçons d'un dépôt de contenu d'un coup — avec le
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
détectées automatiquement — aucune modification de test nécessaire.

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
porter de `body` — utilise plutôt le `prompt` de l'exercice.

## Référence : les ensembles pilotes

Les deux ensembles livrés avec Adaptive Learner sont les références
canoniques :

- `sets/en/fr-a1/` — Français A1 pour anglophones (10 leçons, ~2
  heures) ; `sets/de/fr-a1/` est l'ensemble pilote germanophone.
- `sets/en/es-a1/` + `sets/de/es-a1/` — Espagnol A1 (15 leçons par
  langue source), dans le dépôt `adaptive-learner-content`.

Les deux suivent les conventions décrites dans ce guide. Lire une
leçon complète est le moyen le plus rapide d'intérioriser la
structure.

---

## Voie de participation communautaire (v1.42.0)

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
   de la leçon — aucune progression, aucun historique d'erreurs,
   rien de personnel.
3. Clique sur **Mettre à disposition de la communauté** pour ouvrir
   une **pull request** pré-remplie dans le dépôt de contenu — le
   JSON de leçon est committé au bon chemin dans l'arbre, sans
   pièce jointe `.zip` nécessaire.
4. La CI du dépôt valide automatiquement la PR ; un mainteneur
   vérifie la leçon, met le manifeste (id, title, language, level,
   tags) en accord avec les conventions ci-dessus et le fusionne
   sous `sets/`. Après le merge, tout le monde peut la télécharger
   depuis le navigateur d'ensembles.

C'est la voie sociale : la vérification est **manuelle** (un
mainteneur cure chaque ajout — rien n'est publié automatiquement),
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
   d'exercices — consultatif, jamais bloquant). Si quelque chose de
   similaire existe, tu peux :
   - **Partager comme variation** — la leçon est marquée avec
     `variation_of: "{original_id}"` plus une `variation_note`
     optionnelle (« En quoi ta version diffère-t-elle ? »).
   - **Ne proposer que les nouveaux exercices** (pour les
     quasi-doublons) — l'assistant extrait exactement les exercices
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
manquantes** — des suggestions encourageantes pour le niveau CEFR
suivant d'une paire existante ou une langue cible qui existe pour
une langue source mais manque pour une autre (« Peux-tu aider ? »).

---

## Pages connexes

- [Créer des leçons — aperçu](../content-creation/overview.md) — entrée en matière + créateur de leçons dans l'application
- [Recommandations de livres](../content-creation/books.md) — gérer `books.yaml` par domaine
- [Plusieurs dépôts de contenu](../features/content-repos.md) — connecter son propre dépôt
