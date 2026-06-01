# Curriculum

La page Curriculum organise les sujets et le contenu de votre projet
d'apprentissage en une structure arborescente.

---

## Structure arborescente des sujets

Les sujets peuvent être imbriqués à n'importe quelle profondeur :

```
Français A1
├── Prononciation
│   ├── Voyelles nasales
│   └── Liaisons
├── Grammaire
│   ├── Articles définis et indéfinis
│   ├── Être et avoir
│   └── Présent de l'indicatif
└── Vocabulaire
    ├── La famille
    └── Les couleurs
```

Chaque nœud peut être :
- **Sujet** — conteneur organisationnel
- **Leçon** — unité de contenu avec un éditeur de texte enrichi

---

## Créer des sujets

Cliquez sur **Ajouter un sujet** dans la barre d'outils du curriculum.
Vous pouvez :
- Créer un sujet à la racine
- Créer un sous-sujet dans un sujet existant (cliquez sur les trois points
  d'un sujet)
- Réorganiser par glisser-déposer

---

## Leçons avec éditeur TipTap

Chaque sujet peut contenir des **leçons** — des notes enrichies dans un
éditeur TipTap avec :

- Titres, paragraphes, listes
- Gras, italique, souligné
- Blocs de code avec coloration syntaxique
- Images
- Tableaux
- Formules mathématiques (LaTeX)

Le contenu des leçons est stocké en JSON TipTap et peut être exporté
en Markdown ou en HTML.

---

## Lien avec les sessions

Lors du démarrage d'une session en **mode auto-boucle**, l'application
parcourt les sujets du curriculum dans l'ordre. Le contenu des leçons
alimente le contexte de l'IA pour les sujets marqués.

---

## Importation depuis l'analyse de conversation

Après avoir analysé un chat importé, vous pouvez utiliser **Créer un
curriculum** pour remplir automatiquement la structure du curriculum
à partir des concepts extraits.

---

## Exportation

Le curriculum peut être exporté via le plugin **Learning Repository** sous
forme d'artefact Markdown avec des dossiers de sujets numérotés, adapté
à NotebookLM ou à la publication Git.
