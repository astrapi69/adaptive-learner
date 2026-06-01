# Créer du contenu de leçon

Ce guide vous accompagne dans la création d'un nouvel ensemble de leçons
pour le content-loader d'Adaptive Learner. Quiconque souhaite publier un
ensemble de langues ou de sujets — pour usage personnel ou en contribution
au pool de contenu public — devrait lire ce guide de bout en bout avant
d'écrire des leçons.

## Qu'est-ce qu'un ensemble de contenu

Un **ensemble de contenu** est un lot versionné de leçons qu'un utilisateur
peut télécharger depuis l'Explorateur d'ensembles (`/content`). Le plugin
Content-Loader (fourni dans v1.27.0) gère la découverte, le téléchargement,
la mise en cache et la réconciliation des versions dans les deux modes
de stockage.

Un ensemble comporte trois couches :

1. **Manifeste racine** (`manifest.yaml`) — liste tous les ensembles du dépôt.
   Utilisé par l'Explorateur pour afficher le catalogue de sources.
2. **Manifeste d'ensemble** (`sets/{set-id}/manifest.yaml`) — liste les
   fichiers de leçons dans cet ensemble spécifique.
3. **Fichiers de leçons** (`sets/{set-id}/lessons/NN-slug.json`) — un fichier
   JSON par leçon, validé contre le schéma v1.0 à chaque téléchargement.

Les ensembles pilotes livrés avec Adaptive Learner se trouvent dans le
dépôt de contenu séparé
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
et constituent de bons modèles à copier.

## Paires de langues (v1.44.0)

Chaque ensemble de contenu déclare la PAIRE de langues qu'il enseigne :

- **`target_language`** — ce que l'apprenant APPREND (ex. `fr`).
- **`source_language`** — ce que l'apprenant PARLE DÉJÀ, c'est-à-dire la
  langue dans laquelle les champs `back` des cartes, les `notes` et les
  textes théoriques sont rédigés (ex. `de`).

C'est ce qui fait du « Français pour anglophones » un ensemble *différent*
du « Français pour germanophones » : même cible (`fr`), source différente
(`en` vs `de`), langue d'explication différente.

Les ids d'ensembles encodent la paire comme `{cible}-{niveau}-from-{source}`
(ex. `fr-a1-from-de`), et chaque ensemble déclare un **`path`** pointant
vers son répertoire de langue source (`sets/de/fr-a1`). Un ensemble porte
aussi un **`title`** (dans la langue source) et un **`title_native`**
(dans la langue cible, affiché comme libellé secondaire).

Les deux codes doivent être en ISO 639-1 à 2 lettres, et `source_language`
doit différer de `target_language`. Les ensembles pré-v1.2 sans ces champs
se chargent toujours : l'ancienne clé `language` est acceptée comme
`target_language` et `source_language` prend la valeur par défaut `en`.

## Organisation du système de fichiers

L'arborescence est organisée par langue SOURCE, puis cible+niveau :

```
mon-depot-contenu/
  manifest.yaml               # racine : liste tous les ensembles (avec path + paire)
  sets/
    de/                       # langue source : allemand
      fr-a1/                  # cible français, niveau A1  -> id fr-a1-from-de
        manifest.yaml         # ensemble : liste les leçons
        lessons/
          01-begruessung.json
          ...
        assets/               # images / audio optionnels
    en/                       # langue source : anglais
      fr-a1/                  # -> id fr-a1-from-en
        ...
```

## Format de manifeste

Les deux fichiers de manifeste (racine + ensemble) utilisent la même
structure `schema_version: '1.0'`. Champs obligatoires :

```yaml
schema_version: '1.0'
name: Mon ensemble anglais B1
description: >-
  Description longue optionnelle.
sets:
  - id: language-en-b1        # slug-safe, unique
    title: English B1 (Intermediate)
    language: en              # BCP-47 (ex. en, fr, zh-Hans)
    level: B1                 # CECR pour les langues, libre sinon
    version: '1.0.0'          # semver — incrémenté à chaque release d'ensemble
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Description optionnelle de l'ensemble.
    tags:
      - intermediate
      - business
metadata:
  author: Votre Nom
  license: CC-BY-SA-4.0
```

Le manifeste d'ensemble liste également chaque fichier de leçon :

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

## Schéma de leçon (v1.0)

Chaque leçon est un fichier JSON unique. Structure de premier niveau :

```json
{
  "id": "01-greetings",
  "title": "Salutations",
  "description": "Résumé optionnel de 1-2 phrases.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Cartes

Une carte est la plus petite unité apprénable — généralement un terme
ou concept unique. Chaque carte a un id stable (référencé depuis les
exercices) et une paire recto/verso :

```json
{
  "id": "art-le",
  "front": "le",
  "back": "the (masculine singulier)",
  "notes": "Utilisé avant les noms masculins commençant par une consonne. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

Les notes supportent le Markdown. Utilisez-les pour les conseils de
prononciation, les avertissements de faux amis, les exceptions —
tout ce qui aide la mémorisation à long terme.

### Étapes

Une leçon est une séquence d'étapes, chacune étant soit THEORY (un bloc
Markdown) soit EXERCISE (l'un des types d'exercice) :

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Pourquoi les articles sont importants",
  "body": "# Les articles en français\n\nChaque nom français a un genre..."
}
```

Ou un exercice :

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Associez les salutations",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Associez chaque salutation à sa traduction.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hello"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Référence des types d'exercice

### matching

Exercice de glisser-déposer de paires. Le renderer mélange avant affichage.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Associez chaque nom français à son article.",
  "card_ids": ["nom-1", "nom-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Chaque paire doit avoir exactement deux clés : `left` + `right`.
Validation requiert ≥ 3 paires.

### picture_choice

Choix multiples avec images. ≥ 2 images, exactement une marquée correcte.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Quelle est la salutation du soir ?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Indice Markdown optionnel affiché à la demande.",
  "distractors": ["Bonjour"]
}
```

Note : `is_correct` est une **chaîne** `"true"`, pas un booléen JSON.

### free_text

Tapez la réponse. Le renderer fait d'abord une correspondance exacte,
puis un repli tolérant Levenshtein.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "Comment dit-on 'Thank you' en français ?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Ça commence par M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` est la réponse canonique affichée après une mauvaise tentative.
Incluez ≥ 3 variantes pour couvrir la casse et la ponctuation.

### word_tiles

Arrangez les tuiles dans l'ordre. Le renderer mélange avant affichage.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Arrangez : Je vois un chat.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Même ordre qu'en anglais."
}
```

Si plusieurs ordres de mots sont corrects, ajoutez `accept_orderings`.

### cloze (Phase 52 / v1.35.0 — schéma 1.1)

Remplissez le vide avec des marqueurs `___` visibles dans la phrase.

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Remplissez l'article indéfini.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "article indéfini masculin",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* est l'article indéfini masculin."
}
```

**Modes de rendu** via `cloze_mode` :

- `"type"` (défaut) : un `<input>` par vide.
- `"select"` : un `<select>` par vide. Les options viennent de `accept[0]` +
  les `distractors`. **Requiert des `distractors` non vides.**

## Direction des exercices (v1.46.0 / EXP-018)

Chaque exercice accepte un champ `direction` optionnel :

- `target_to_source` (défaut) — RÉCEPTIF : l'apprenant voit la langue cible
  et reconnaît la langue source (plus facile).
- `source_to_target` — PRODUCTIF : l'apprenant voit la langue source et
  produit la cible (plus difficile).
- `both` / `random` — laisse le renderer / générateur adaptatif choisir.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

Le champ est additif — le schéma reste à la version 1.2 et les leçons
sans `direction` se comportent exactement comme avant (réceptif).

## Assets (images fournies avec un ensemble) — v1.37.0+

Les exercices de choix d'images et les images de couverture de cartes
proviennent soit de fichiers d'assets rédigés, soit de SVG de remplacement
générés à l'exécution.

### Organisation des répertoires

```
sets/
  language-fr-a1/
    manifest.yaml
    lessons/
      01-greetings.json
    assets/
      img/
        chat.png
        chien.png
```

### Limites de taille et format

- **Limite par asset** : 500 Kio.
- **Limite douce par ensemble** : 10 Mio total.
- **Formats acceptés** : `.png` / `.jpg` / `.jpeg` / `.webp` / `.svg`.
  Pas de GIF (contenu animé = distraction) ni de BMP.

Les tuiles de choix d'images s'affichent à max 150×150 px sur bureau,
100×100 px sur mobile.

## Liste de contrôle qualité

Avant d'ouvrir une PR pour une nouvelle leçon, vérifiez :

- [ ] **3-5 étapes théoriques** + **8-12 exercices** par leçon
- [ ] **Au moins 3 types d'exercices** représentés
- [ ] **Étapes théoriques ≤ 200 mots** chacune
- [ ] **Exercices texte libre** : ≥ 3 variantes acceptées + ≥ 3 distracteurs
- [ ] **Assemblage de mots** : ≥ 3 tuiles par exercice
- [ ] **estimated_minutes** : 10-15 (réaliste, pas aspirationnel)
- [ ] **Les distracteurs sont faux-mais-plausibles** — sémantiquement liés
- [ ] **Notes de cartes** apportent une valeur réelle (prononciation, faux ami)
- [ ] **Structure progressive** : les concepts ultérieurs s'appuient sur les antérieurs
- [ ] **Exactitude culturelle** : usage réel, pas seulement manuel scolaire
- [ ] **Validation de schéma** : la leçon se charge via `dict_to_lesson()`
- [ ] **Intégrité des card-ids** : chaque `exercise.card_ids[i]` existe dans `cards[]`
- [ ] **Paire de langues** : `target_language` + `source_language` définies, `title_native` présent

## Validation (deux couches, v1.44.0)

Le contenu est filtré par deux couches de validation qui exécutent les
MÊMES contrôles :

1. **Dans l'application, avant partage.** Lors du partage d'une leçon via
   *Mes leçons → Partager avec la communauté*, un contrôle basé sur des règles
   s'exécute d'abord. Une révision IA complémentaire est optionnelle
   (précision de traduction, plausibilité des distracteurs, grammaire,
   adéquation de niveau) — elle n'est jamais automatique et ne bloque jamais
   le partage.
2. **Dans la CI du dépôt de contenu.** Une PR vers
   `astrapi69/adaptive-learner-content` exécute `scripts/validate_content.py`,
   qui vérifie chaque ensemble avec les mêmes règles.

**Minimums qualité (porte obligatoire) :** ≥ 5 exercices par leçon,
≥ 2 types d'exercices, ≥ 1 étape théorique, texte libre ≥ 2 réponses
acceptées + distracteurs, matching ≥ 3 paires, pas de recto/verso vide.

## Tests locaux

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} cartes, {len(lesson.steps)} étapes')
"
```

Pour valider chaque leçon d'un dépôt de contenu :

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

## Flux de PR

Une fois votre ensemble prêt :

1. Ouvrez une PR contre le dépôt principal adaptive-learner (pour les
   ensembles devant être livrés avec l'application), OU
2. Créez votre propre dépôt de contenu sous votre compte GitHub et pointez
   le Content-Loader vers lui depuis
   `backend/config/plugins/content-loader.yaml` (sous `default_sources`).

## Pièges courants

**Références de card-id** : chaque entrée `card_ids` dans un exercice doit
exister dans `cards[]` de la leçon.

**Ids slug-safe** : tous les ids doivent correspondre à `^[a-z0-9]+(-[a-z0-9]+)*$`.
Pas de tirets bas, pas d'apostrophes, pas de majuscules.

**`is_correct: "true"`** : c'est une chaîne, pas un booléen JSON.

**Champs supplémentaires** : chaque modèle a `extra="forbid"`. Ajouter
un champ inconnu du schéma rejettera la leçon entière.

---

## Chemin de contribution communautaire (v1.42.0)

La façon la plus rapide de contribuer est de **créer une leçon dans
l'application et de la partager** :

1. Importez un chat et analysez-le, puis **Enregistrer comme leçon hors ligne**
   (ou terminez une leçon adaptative et cliquez **Enregistrer cette leçon ?**).
2. Depuis Mes leçons, cliquez sur **Exporter en ensemble** pour télécharger
   un `.zip`.
3. Cliquez sur **Partager avec la communauté** pour ouvrir un formulaire
   GitHub pré-rempli sur le dépôt de contenu.
4. Un mainteneur révise la leçon et l'ajoute sous `sets/`.

## Assistant de partage (Phase 64)

Partager une leçon depuis **Mes leçons** ouvre un assistant en quatre étapes :

1. **Aperçu + placement.** L'application calcule où la leçon atterrit dans
   l'arborescence.
2. **Vérification des doublons.** La leçon est comparée aux leçons existantes
   (consultatif — ne bloque jamais). Vous pouvez **partager comme variante**
   ou **suggérer uniquement les nouveaux exercices**.
3. **Résumé qualité.** Les résultats du validateur basé sur des règles
   (plus la révision IA optionnelle).
4. **Partager + célébrer.** Un clic ouvre la PR/issue GitHub.

### Champs variante + crédit (schéma 1.3, tous optionnels)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Plus d'exercices sur l'accord",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```
