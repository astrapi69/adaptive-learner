# Dépôts de contenu - publier ton propre dépôt

Adaptive Learner est livré avec une bibliothèque de contenu officielle,
mais le système de contenu est ouvert : tu peux gérer ton **propre
dépôt de contenu** sur GitHub, le connecter dans l'application et le
mettre à disposition d'autres apprenants. Cette page en donne
l'aperçu ; les instructions complètes pas à pas se trouvent dans le
**[Guide des dépôts de contenu](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**.

---

## Qu'est-ce qu'un dépôt de contenu ?

Un dépôt de contenu est un dépôt GitHub qui contient des **ensembles
de contenu** au format Adaptive Learner. Un ensemble est une
collection de leçons pour une paire de langues et un niveau (par
exemple « Espagnol A1 pour germanophones ») ou pour un domaine de
connaissances (par exemple « Bases de Python »).

La bibliothèque officielle et tous les dépôts d'utilisateurs utilisent
le **même format** - il n'existe pas de schéma « officiel » séparé.
Dès que ton dépôt passe la validation, c'est une source de contenu à
part entière. Tu n'as jamais besoin de ton propre serveur : un dépôt
de contenu n'est qu'un ensemble de fichiers dans un dépôt Git.

---

## Prérequis

- Un **dépôt GitHub** (public ; un dépôt privé est aussi possible,
  via un jeton par dépôt).
- Un **`manifest.yaml`** à la racine qui liste tes ensembles.
- Des leçons au **format de leçon**.
- Python 3 avec PyYAML, pour valider localement avant de publier.

Les références de format qui font autorité se trouvent dans le dépôt
de contenu officiel :

- [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

---

## Arborescence des dossiers

Un dépôt de contenu suit une arborescence fixe. La langue source (la
langue dans laquelle les explications sont rédigées) est le dossier du
haut ; la langue cible et le niveau forment le suivant :

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

## Valider localement

```bash
pip install pyyaml
python3 scripts/validate_content.py
```

Code de sortie 0 lorsque chaque ensemble passe, sinon 1 avec un
rapport par fichier. Il vérifie le schéma, la structure des dossiers
et les seuils de qualité minimaux (au moins 5 exercices, 2 types
d'exercices, 1 étape de théorie par leçon, des champs de carte non
vides, etc.).

---

## Comment est-il listé dans l'application ?

Une fois ton dépôt validé, un apprenant le connecte sous
**Paramètres > Données > Dépôts de contenu** : il colle l'URL,
l'application récupère le manifeste racine, effectue la validation
technique, synchronise et met en cache les ensembles. Ceux-ci
apparaissent ensuite dans le **Navigateur de contenu** avec un badge
de source. Les dépôts peuvent aussi être partagés via un lien
`/add-repo` accompagné d'un code QR.

Un dépôt n'atteint la section **Dépôts recommandés** de l'application
que par le fichier curaté `recommended-repos.json` de l'équipe du
projet - le canal de la recommandation officielle (Confiance 3).

---

## Niveaux de confiance

Le niveau de confiance indique à l'apprenant quel degré de
vérification le contenu a reçu. Il porte sur la provenance et la
relecture, pas sur un jugement de qualité.

| Niveau | Nom | Signification |
|-------|------|---------|
| **1** | Validé | Schéma correct, seuils de qualité minimaux atteints - automatiquement lors de la synchronisation. Contenu non vérifié individuellement. |
| **2** | Vérifié | Proposé par la communauté et relu par un mainteneur pour l'exactitude du contenu. |
| **3** | Officiel | Sélectionné et dont la qualité est garantie par l'équipe du projet. |

La confiance 2+ exige plus que les minimums techniques : des
traductions exactes, des articles et genres corrects, des accents
complets, une progression cohérente, des distracteurs plausibles et
une exactitude culturelle. Une **vérification par IA** optionnelle
dans l'application aide les auteurs à repérer ces problèmes avant le
partage (voir EXP-033) ; elle est consultative et ne bloque jamais le
partage.

---

## Réciprocité pour les cours et les sites web (EXP-029)

Les leçons et les domaines peuvent porter des **médias
d'accompagnement** (vidéos, podcasts, articles, livres, cours, sites
web). Le filtre pour les médias commerciaux est la **réciprocité, pas
le prix** : les médias gratuits sont toujours autorisés ; les cours et
sites web commerciaux seulement lorsque le fournisseur renvoie un lien
en retour, gère son propre dépôt de contenu ou dispose d'un
partenariat documenté. Cela fait des auteurs de contenu des
partenaires de l'écosystème plutôt que des annonceurs. Détails dans
`docs/explorations/EXP-029-media-reciprocity.md`.

---

## Le kit de démarrage comme modèle

Le démarrage le plus rapide passe par le dépôt de démarrage prêt à
l'emploi
**[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test)** :
il contient `docs/`, des modèles par domaine, une leçon d'exemple
complète (l'effet Inception), un ensemble d'exemple exécutable,
`books.yaml` et le validateur. Forke-le, remplace la leçon d'exemple
par la tienne, enregistre-la dans le `manifest.yaml` racine, valide et
connecte le dépôt dans l'application.

---

## Voir aussi

- **[Guide complet des dépôts de contenu](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**
- [Créer des leçons - aperçu](overview.md)
- [Recommandations de livres](books.md)
