# Foire aux questions

## Mes données sont-elles en sécurité ?

En **mode Local**, votre navigateur stocke vos données sur votre propre
appareil (dans IndexedDB et localStorage), entre autres votre
progression, les conversations importées et vos paramètres, y compris
les clés API et le token GitHub ; aucun serveur de l'exploitant
n'intervient. D'autres n'en reçoivent des parties que lorsqu'une
fonction en a besoin, par exemple votre fournisseur d'IA lorsque vous
utilisez l'IA, ou GitHub lorsque l'application demande d'elle-même, au
démarrage, s'il y a de nouveaux contenus. Fermer l'onglet du
navigateur ne supprime pas ces données ; effacer les données du site
dans le navigateur les retire de votre appareil. Sur un appareil
partagé, toute personne ayant accès à ce profil de navigateur peut les
lire.

En **mode Serveur**, vos données d'apprentissage se trouvent dans la base
SQLite que gère le backend FastAPI. Ce qui est créé hors ligne en
matière de progression des leçons et d'enregistrements vocaux attend
dans ce navigateur jusqu'à ce que l'application le transfère ; la
quantité maximale en attente et ce qu'il advient du reste sont
indiqués dans [Sauvegarde et restauration](../features/backup.md). Les
clés API sont stockées chiffrées (Fernet) dans
`~/.config/adaptive_learner/secrets.yaml`, et, pour chaque fournisseur,
une copie de sauvegarde de la dernière clé API qui a fonctionné se
trouve, chiffrée elle aussi, dans la base de données. La clé de
chiffrement est générée au premier démarrage et enregistrée dans
`~/.config/adaptive_learner/secret.key` ; vous n'avez rien à
configurer. Si vous voulez fournir votre propre clé, définissez
`ADAPTIVE_LEARNER_SECRET_KEY` (ou `secret_key:` dans `secrets.yaml`)
avant le premier démarrage.

Aucun mode n'envoie de télémétrie, de mesure d'audience ni vos messages
à des tiers, sauf au fournisseur d'IA que vous avez choisi. Dans une session d'apprentissage, ce
fournisseur reçoit :

- l'instruction système, avec le sujet et l'objectif de votre projet
  d'apprentissage, une indication de profil (votre méthode
  d'apprentissage préférée et sa pondération), vos leçons terminées avec
  leurs résultats, la leçon et l'étape en cours, vos erreurs récentes
  (chacune avec votre réponse, la bonne réponse et sa fréquence) et la
  langue dans laquelle l'IA doit répondre ; une session lancée depuis une
  conversation importée contient l'analyse et l'historique de cette
  conversation au lieu de votre progression ;
- vos messages et les réponses précédentes de l'IA dans la session ;
- comme pour chaque requête, entre autres, votre adresse IP et votre
  clé API.

Vos XP et vos badges n'en font pas partie. D'autres fonctions d'IA
envoient elles aussi des données à votre fournisseur, par exemple
l'analyse d'une conversation importée. La
[vérification du contenu par l'IA](ai-validation.md) envoie les cartes
du set vérifié (pour chaque carte, son identifiant, son recto, son verso
et ses notes). La revue IA avant le partage n'envoie, parmi vos leçons,
que celles que vous partagez et, de celles-ci, entre autres les cartes,
les textes des étapes et les exercices (consigne et mauvaises réponses
proposées). Les deux envoient aussi la langue source, la langue cible et
le niveau du set. Ce que vous écrivez vous-même dans ce contenu est
envoyé avec lui et peut lui-même être personnel. La
[politique de confidentialité](../legal/privacy.md) énumère chaque
requête à l'IA.

## Ai-je besoin d'une clé API ?

Oui, pour les sessions d'IA. L'application suit le principe
**Bring-Your-Own-Key** (vous apportez votre propre clé) pour chaque
fournisseur pris en charge : Anthropic Claude, OpenAI GPT et Google
Gemini, ainsi que Perplexity en mode Serveur (l'application de bureau ;
la version navigateur ne peut pas appeler Perplexity directement). Les
quotas gratuits suffisent généralement pour commencer.

Trois emplacements pour la clé (la priorité la plus haute l'emporte) :
une variable d'environnement `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`,
le champ `ai.<provider>.api_key` dans
`~/.config/adaptive_learner/secrets.yaml`, ou l'interface des paramètres
(qui l'enregistre chiffrée dans ce même fichier). Pour chaque
fournisseur, l'interface indique la source, de sorte que vous savez
toujours d'où vient votre clé.

Sans clé API, vous pouvez parcourir le programme, passer le test de
profil d'apprentissage, consulter le tableau de bord et même lancer
l'import d'historique de chat. La page de session, l'étape d'analyse et
les fonctions d'extraction par l'IA sont celles qui ont besoin d'une
clé.

## Puis-je utiliser l'application hors ligne ?

En partie. Le service worker de la PWA met en cache les ressources
statiques (HTML, JS, CSS, icônes), de sorte que l'application démarre
sans Internet. Les sessions passées et les données du tableau de bord se
chargent aussi depuis le stockage local, ce qui permet de relire
d'anciens contenus.

**Les sessions en direct ont toujours besoin d'Internet**, car le
fournisseur d'IA se trouve en dehors de votre navigateur. La page de
session détecte l'absence de connexion et affiche un message clair dans
la page au lieu d'échouer en silence.

## Que signifie le changement de méthode ?

Lorsque trois sessions de suite montrent que votre compréhension stagne
et que votre stress est élevé, l'application affiche une bannière :
« Voulez-vous essayer [autre méthode] pour la prochaine session ? ». La
recommandation privilégie votre deuxième méthode la plus forte du test,
que vous n'avez pas utilisée récemment.

C'est une *suggestion*, pas un ordre. Vous pouvez fermer la bannière et
continuer avec votre méthode actuelle ; la bannière revient si la
stagnation persiste. Les changements de méthode sont enregistrés dans
la table `method_switches` et apparaissent dans la répartition des
méthodes de la page Progrès.

## Qu'est-ce que l'auto-boucle ?

Lorsqu'une session atteint l'étape 7 (intégrer) et que l'évaluateur de
transition de sujet juge le sujet intégré ET digne d'être poursuivi, un
nouveau cycle démarre automatiquement avec un nouveau sous-sujet.
Jusqu'à 5 cycles par session (protection contre les boucles sans fin).
L'historique du chat affiche, à chaque transition, des cartes « Cycle N »
à bordure en pointillés. La boîte de dialogue d'évaluation en fin de
session résume le parcours sur plusieurs cycles lorsque
`cycle_count > 1`.

Uniquement dans l'application de bureau : dans la version navigateur,
la session reste à l'étape 7, et la page de la session l'indique.
Terminez-y la session et démarrez-en une nouvelle.

## Puis-je exporter mes données ?

Oui, entre autres de ces façons :

- **Sauvegarde** : Paramètres > Données > Sauvegarde et export >
  Créer une sauvegarde. Télécharge un fichier de sauvegarde `.alb` ;
  vous pouvez créer une sauvegarde dans les deux modes de stockage. Vos
  clés API n'y sont pas incluses ; la façon de les transférer est
  décrite sur la page [Paramètres](settings.md), dans la section
  « Export chiffré des clés (.alk) ». La page
  [Sauvegarde et restauration](../features/backup.md) cite d'autres
  exemples de ce qu'une sauvegarde ne contient pas.
- **Rapports de progression, de session et de programme** :
  Paramètres > Données > Sauvegarde et export > Exporter.
  Markdown + PDF (impression en PDF du navigateur).
- **Anki .apkg** : vérifiez sur la page `/anki` les flashcards
  extraites par l'IA, acceptez celles que vous voulez, cliquez sur
  Exporter. Le fichier fonctionne directement dans Anki Desktop.
- **ZIP NotebookLM** : depuis la page Progrès, téléchargez un ZIP
  structuré (résumé + vocabulaire + règles + erreurs + flashcards +
  sessions), mis en forme pour l'import de sources dans NotebookLM.

## Qu'est-ce que la fonction vocale ?

Trois intégrations de la Web Speech API :

- **Synthèse vocale** pour les réponses de l'IA et les résultats du
  test : un bouton ▶ à côté de chacun les lit à voix haute, dans la
  langue qui convient.
- **Reconnaissance vocale** dans la saisie de session : un bouton 🎤
  enregistre votre voix et remplit la zone de texte avec la
  transcription intermédiaire avant l'envoi.
- **Exercice de prononciation** pour les projets de langue : rendez-vous
  sur `/pronunciation`, l'IA génère une phrase cible, vous la prononcez,
  et une IA juge évalue la ressemblance et propose des améliorations.

Les réglages vocaux se trouvent dans Paramètres > Apprentissage >
Lecture à voix haute et dictée. Cette zone est masquée dans les
navigateurs qui ne prennent pas en charge l'API.

## Qu'est-ce que l'import d'historique de chat ?

La page d'import (`/import`) accepte les transcriptions de chat collées
ou téléversées depuis ChatGPT, Claude.ai (l'export JSON global comme
l'export Markdown d'une seule conversation), Gemini et tout Markdown.
L'analyseur extrait votre sujet, vos points faibles, vos schémas
d'erreurs, la méthode recommandée, le vocabulaire (pour les
conversations de langue) et une proposition de programme. Un clic crée
un programme et lance une session ciblée à partir de l'analyse.

L'export Markdown d'une seule conversation de Claude.ai est un cas
d'import vérifié : pour ce format, l'analyseur extrait les horodatages
complets et conserve les limites entre les rôles.

## Synchronisation entre appareils ?

Pas encore. L'application ne peut pas encore synchroniser vos données
entre appareils : vous ne pouvez pour l'instant associer aucun appareil,
et sans association, la synchronisation n'échange aucune donnée. Ce que
vous voyez sous Paramètres > Données > Synchronisation dépend du mode de
stockage :

- En mode Local, cette zone affiche, au lieu de commandes, l'avis
  « Disponible uniquement avec l'application de bureau. » La version
  navigateur utilise toujours le mode Local, y compris comme application
  web installée ; dans l'application de bureau, le même avis apparaît
  tant qu'elle est réglée sur le mode Local (Paramètres > Général >
  Mode de stockage : « Local (Navigateur) »). L'application de bureau ne
  synchronise toutefois pas encore non plus (voir le point suivant).
- En mode Serveur de l'application de bureau (Paramètres > Général >
  Mode de stockage : « Serveur »), cette zone affiche des champs pour
  l'hôte et le port et le bouton « Générer un code d’association ». Un
  clic sur ce bouton affiche un lien d'association, un QR code et un
  bouton pour copier le lien. Mais aucun appareil ne peut encore
  utiliser ce lien, pas même via le QR code ; il n'est donc pas encore
  possible d'associer ainsi un deuxième appareil.

Tant que la synchronisation n'est pas disponible, vous transférez vos
données vers un autre appareil avec une sauvegarde, mais pas toutes.
Entre autres, une sauvegarde ne contient pas vos clés API ; la façon de
transférer les clés API est décrite sur la page [Paramètres](settings.md),
dans la section « Export chiffré des clés (.alk) ». La page
[Sauvegarde et restauration](../features/backup.md) cite d'autres
exemples de ce qu'une sauvegarde ne contient pas.

## En quoi est-ce différent de ChatGPT ?

ChatGPT est une interface de chat vers un modèle unique. Adaptive
Learner est un *système d'apprentissage structuré* qui utilise une IA en
coulisse, mais qui apporte en plus :

1. **Une matrice 6 méthodes × 7 étapes** d'invites système sur mesure.
2. **Une évaluation de l'étape à chaque tour** : un deuxième appel à
   l'IA juge si vous êtes prêt et peut vous faire avancer ou reculer.
3. **L'auto-boucle vers de nouveaux cycles**, lorsque le sujet est
   intégré.
4. **Un profil** de vos préférences d'apprentissage, issu du test de
   12 questions.
5. **Un suivi à long terme** : ProgressCommits, carte thermique des
   séries, XP, badges, graphiques du temps par étape. ChatGPT oublie
   quand vous fermez l'onglet.
6. **Le libre choix du fournisseur** : Anthropic, OpenAI ou Gemini,
   ainsi que Perplexity en mode Serveur.
7. **Une option local-first** : en mode Local, votre navigateur stocke
   entre autres la progression, les statistiques et les paramètres ;
   d'autres n'en reçoivent des parties que lorsqu'une fonction en a
   besoin. L'application contacte des serveurs lorsqu'une fonction en a
   besoin, par exemple GitHub pour les contenus (elle vérifie aussi
   d'elle-même, au démarrage, les dépôts connectés), votre fournisseur
   d'IA, et GitHub lorsque vous partagez quelque chose ou y ouvrez un
   rapport d'erreur. La [politique de confidentialité](../legal/privacy.md)
   décrit ces cas et ce qui est transmis.

## Et si l'IA se trompe ?

Le système échoue de façon visible :

- **Clé API erronée** : l'appel à l'IA renvoie un message d'erreur
  clair, dans le chat.
- **Fournisseur en panne** : de même, l'affichage de l'erreur montre le
  statut HTTP de l'API du fournisseur.
- **Erreur d'analyse JSON de l'évaluateur** : une avance déterministe de
  +1 s'applique (plafonnée à l'étape 7), enregistrée avec
  `fallback_used: true`, afin qu'un audit ultérieur puisse repérer les
  modèles qui ont du mal avec le format.
- **Streaming interrompu en cours de route** : la réponse partielle est
  conservée ; le message suivant reprend à partir de là.
- **Réponse de l'IA obsolète ou étrange** : terminez la session,
  donnez-lui une note basse, recommencez. L'heuristique de changement de
  méthode proposera une autre méthode si cela se répète.
