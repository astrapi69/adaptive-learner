# Paramètres

La page Paramètres est organisée en onglets. Voici un aperçu de chaque
section.

---

## Général

### Apparence

Choisissez parmi six thèmes :

| Thème | Style |
|-------|-------|
| `light` | Clair - blanc et tons clairs |
| `dark` | Sombre - fond foncé |
| `ocean` | Bleus et teintes océan |
| `forest` | Verts forestiers |
| `high-contrast` | Contraste élevé WCAG AA |
| `sepia` | Tons chauds sépia |
| `auto` | Suit le thème du système d'exploitation |

Le changement de thème est instantané - aucun rechargement nécessaire.

### Langue

Sélectionnez votre langue d'interface parmi les huit disponibles :
allemand, anglais, espagnol, français, grec, portugais, turc, japonais.

### Mode développeur

Activé, ce mode affiche les détails techniques complets dans les messages
d'erreur (statut HTTP, endpoint, trace). Désactivé par défaut - les
utilisateurs en production voient des messages d'erreur conviviaux.

---

## IA

### Fournisseur actif

Choisissez parmi Anthropic, OpenAI ou Gemini. Le fournisseur sélectionné
est utilisé pour toutes les sessions IA, analyses et générations.

### Clés API

Entrez les clés API pour chaque fournisseur. Les clés sont chiffrées
(Fernet) dans la base de données locale.

La source de la clé est indiquée pour chaque fournisseur :
- **Paramètres** - entrée dans cette interface
- **Variable d'environnement** - définie externement, le champ est désactivé
- **secrets.yaml** - lue depuis `~/.config/adaptive_learner/secrets.yaml`

### Modèle

Pour chaque fournisseur, sélectionnez le modèle à utiliser (par ex.
`claude-opus-4-5`, `gpt-4o`, `gemini-2.0-flash`).

---

## Apprentissage

L'onglet **Apprentissage** regroupe ses cartes en cinq zones étiquetées,
dans l'ordre où se déroule une leçon. Chaque zone porte un petit titre
et une description d'une ligne ; les cartes gardent leurs propres titres.

Une **barre de sections** au-dessus des zones les liste sous forme de
puces : un clic saute à la zone correspondante. Sur un ordinateur, la
barre reste visible sous l'en-tête de l'application pendant le
défilement ; sur un téléphone, elle défile avec la page et la rangée se
fait glisser latéralement. La barre reflète l'adresse :
`/settings?tab=learning&section=review` ouvre l'onglet déjà positionné sur
*Après la leçon* (identifiants : `basics`, `lessons`, `voice`, `review`,
`motivation`), et un clic sur une puce met l'adresse à jour sans ajouter
d'entrée à l'historique. Changer d'onglet abandonne la section. Une zone
non affichée (la lecture à voix haute dans un navigateur sans Web Speech)
n'a pas de puce, et un identifiant inconnu est ignoré.

### Bases

Qui apprend, et dans quelles langues.

- **Profil d'apprentissage** - créer, poursuivre ou refaire le profil
  d'apprentissage derrière les poids des six méthodes.
- **Langues source supplémentaires** - les langues source que l'arbre
  de contenu affiche en plus de votre langue d'application.

### Pendant la leçon

Comment les exercices se comportent pendant que vous répondez.

- **Mode de leçon** - le **mode par défaut** (Entraînement / Examen /
  Chronométré), le **seuil de réussite** de l'examen et la **difficulté
  du mode chronométré** (Rapide, Normal, Détendu).
- **Indices** - si un bouton d'indice par paliers apparaît sur chaque
  exercice, et le **coût en XP par indice** (0 = gratuit).
- **Interaction** - les **gestes de balayage** (balayer pour naviguer
  dans l'Évaluation, la Session et le Programme ; activés par défaut sur
  les appareils tactiles), les **raccourcis clavier dans les leçons**
  (Entrée vérifie la réponse, Entrée à nouveau passe à la suite), le
  **passage automatique après une bonne réponse** et l'affichage du
  bouton **Demander à l'IA**.
- **Direction d'exercice préférée** - pour les leçons avec des exercices
  directionnels : **Auto** (réceptif d'abord, puis productif une fois la
  reconnaissance solide), **Réceptif en priorité**, **Focus productif**
  ou **Équilibré**.
- **Animation de résolution** - l'effet joué quand un exercice
  d'association est résolu.

### Lecture à voix haute et dictée

Voix, vitesse, microphone et entraînement à la prononciation.

- **Voix** - synthèse vocale, lecture automatique des réponses de l'IA,
  reconnaissance vocale et entraînement à la prononciation.

Cette zone n'apparaît que si le navigateur prend en charge au moins un
côté de la Web Speech API (synthèse ou reconnaissance). Sinon elle est
absente, titre compris, et *Après la leçon* suit directement *Pendant la
leçon*.

### Après la leçon

Séances de révision, résumé de la leçon et reprise des erreurs.

- **Révision** - les explications d'erreurs générées automatiquement et
  le nombre de questions par séance de révision. La carte se termine par
  le bloc en lecture seule **Répétition espacée** : le calendrier des
  intervalles (bonnes réponses d'affilée contre jours avant la prochaine
  révision), à partir de quand un élément compte comme maîtrisé, et un
  lien vers la méthode d'apprentissage.
- **Résumé après les leçons** - les sections que le résumé de fin de
  leçon affiche, et dans quel ordre.
- **Revoir les erreurs** - les erreurs que la reprise récupère.

### Motivation et routine

Mode jeu, retour, missions quotidiennes et rappels.

- **Mode jeu** - les leçons ludiques, avec l'interrupteur principal, les
  sons du mode jeu et un volet de détails replié qui mémorise votre
  choix ; tant que les leçons ludiques sont désactivées, les options du
  volet sont grisées.
- **Retour** - l'**intensité des retours** (animations et phrases de
  félicitations : Subtil, Normal, Enthousiaste ; l'option
  `prefers-reduced-motion` du système force Subtil) et les **sons**
  (désactivés par défaut, avec réglage du volume et bouton Test).
- **Missions quotidiennes** - si les missions sont actives, combien par
  jour, le mélange de difficulté et le remaniement des missions du jour.
- **Rappels** - l'heure du rappel et les jours où il s'applique.
- **Gamification** - les notifications XP / badge, le mode week-end,
  l'objectif de sessions quotidien et la réinitialisation ; c'est la
  dernière carte de l'onglet, voir ci-dessous.

L'affichage du contenu (liste / grille) et l'ordre des onglets du hub de
contenu se trouvent dans l'onglet **Général**, sous *Apparence*. Les deux
réglages de nettoyage, *Conservation des leçons en pause* et *Taille
maximale de leçon*, sont dans l'onglet **Données**.

### Gamification

La dernière carte de l'onglet, sous un séparateur parce qu'elle contient
la réinitialisation.

#### Afficher la gamification

Bascule la visibilité des éléments XP, badge et série sur le tableau
de bord.

#### Galerie des badges

Ouvre la galerie de badges complète avec filtrage, tri et vue des
critères de déverrouillage pour chaque badge.

#### Réinitialiser

Réinitialise les données XP, badge et série. Le curriculum, les sessions
et les évaluations sont préservés. Nécessite une double confirmation.

---

## Données

### Mode de stockage

Bascule entre **Mode API** (backend SQLite) et **Mode Dexie** (IndexedDB
navigateur). Un rechargement de page est nécessaire après le changement.

### Sauvegarde et restauration

Exportez toutes vos données en JSON. Importez une sauvegarde précédente.

### Synchronisation locale

Si activée, synchronise les données avec d'autres appareils sur votre
réseau local.

### Exportation Anki

Accès direct à la gestion des flashcards Anki - voir la [section Anki
du guide](../user-guide/getting-started.md).

### Taille maximale de leçon

Carte placée juste sous le *Cache hors ligne*. Lorsqu'une longue analyse de
conversation est enregistrée comme leçon hors ligne, les leçons de plus de
ce nombre d'étapes sont découpées en plusieurs parties. *Étapes par
partie* : de 5 à 20, défaut 10.

### Conservation des leçons en pause

Carte placée juste au-dessus du nettoyage *Contenu déconnecté* (qui
n'apparaît que s'il y a quelque chose à nettoyer). Les leçons en pause plus
anciennes que ce délai sont automatiquement abandonnées au prochain
chargement du tableau de bord : 7, 14, 30 ou 60 jours, ou jamais. Défaut :
30 jours. Au plus 10 leçons en pause sont conservées quel que soit leur âge.

Les deux valeurs sont enregistrées dans ce navigateur et s'appliquent en
mode API comme en mode Dexie.

---

## Aide / À propos

Affiche la version actuelle de l'application, les liens vers la documentation
et GitHub, et les informations de licence.
