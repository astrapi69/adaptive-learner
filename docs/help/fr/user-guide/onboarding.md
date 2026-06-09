# Intégration

Depuis la **v1.64.0**, l'entrée en matière est volontairement
courte : le **démarrage rapide** ne demande que deux champs.

1. **Nom** — comment l'application doit s'adresser à toi.
2. **Sujet** — ce que tu veux apprendre. « Grammaire espagnole »,
   « Bases du machine learning », « Improvisation solo à la
   guitare ». Sois concret ; c'est l'ancre de ton projet.

Tout le reste (objectif, échéance, minutes par jour, langue) prend
des **valeurs par défaut** sensées, que tu peux modifier à tout
moment.

## Démarrer directement ou configurer le profil

Après l'envoi, l'application te propose deux voies :

- **Démarrer directement** — tu arrives immédiatement sur le
  tableau de bord et peux démarrer une leçon ou une session.
- **Configurer le profil** — ouvre l'**assistant d'intégration** :
  une question par écran (objectif → échéance → minutes par jour →
  problème actuel → test de style d'apprentissage optionnel),
  chacune préremplie, de sorte que « Suivant » fonctionne toujours,
  plus une barre de progression et « Retour ». Les réponses sont
  enregistrées dans les deux modes de stockage.

Le **test de style d'apprentissage n'est plus obligatoire** — il
n'est accessible que via la dernière étape de l'assistant. Pour en
savoir plus : [Test de style d'apprentissage](assessment.md).

## Évaluation reprenable

Si tu interromps le test de style d'apprentissage en cours de
route, l'application retient l'état intermédiaire (question
actuelle, réponses déjà données, heure de début) par projet, de
sorte que tu **reprends là où tu t'es arrêté**. Le tableau de bord
et les paramètres t'invitent activement à **reprendre, créer ou
refaire** ton profil d'apprentissage. Dès que le profil est
calculé, l'état intermédiaire est abandonné.

## Optionnel : problème actuel

À l'étape « problème actuel », tu peux apporter d'emblée une
question ouverte dans le projet. Si tu la renseignes, la première
session IA démarre avec cet obstacle concret au lieu d'une invite
ouverte « sur quoi veux-tu travailler ? ».

## Sujets et tags

Tu peux associer en option à ton projet un **sujet** (domaine issu
de l'arbre de taxonomie pré-amorcé) et des **tags** (étiquettes de
texte libre séparées par des virgules). Les deux apparaissent plus
tard dans la barre de filtres du tableau de bord ; le filtre par
sujet ne liste que tes propres sujets, triés par usage le plus
fréquent. Qui choisit un sujet de langue débloque l'exercice de
prononciation.

## Modifier le projet

Les détails du projet ne sont pas gravés dans le marbre. Sur la
page Curriculum, tu peux ajuster le sujet et l'objectif dès que tu
découvres ce que tu veux vraiment apprendre. Tu changes la langue
dans les paramètres.

## Ce qui n'est pas enregistré

- **Pas d'e-mail**, pas de mot de passe, pas de compte.
- **Pas d'analytics**, pas de traceurs tiers.
- **Aucune télémétrie** ne quitte ton appareil en mode local.

Ton fournisseur d'IA voit tes messages (c'est bien le but de la
requête IA). Adaptive Learner lui-même n'enregistre que ce que tu
tapes — localement ou dans le backend FastAPI, selon le
[mode de stockage](settings.md) configuré.
