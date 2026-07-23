# Leçons de contenu et révisions

Une **leçon de contenu** est une petite unité d'apprentissage
artisanale (généralement 5 à 10 minutes), téléchargée depuis un
ensemble de leçons public. Elle se déroule dans un lecteur dédié,
pas dans la session de chat IA. Après la leçon, l'application
retient précisément quels mots, paires ou phrases tu as mal
répondus, et les planifie pour une session de révision ciblée plus
tard.

Les leçons sont une **voie d'apprentissage alternative** qui ne
nécessite aucune clé d'API IA — idéale pour essayer l'application
ou pour des contenus où du matériel curaté fonctionne mieux qu'un
chat libre.

---

## D'où viennent les leçons

Les leçons vivent dans des **ensembles de contenu** — de petits
paquets publiés dans des dépôts GitHub publics. Le **navigateur
d'ensembles** sous `/content` liste chaque ensemble disponible ;
clique sur l'un d'eux pour le télécharger. L'ensemble est mis en
cache localement (dans le système de fichiers en fonctionnement
backend, dans IndexedDB en mode purement navigateur), de sorte
qu'après le premier téléchargement tu peux apprendre hors ligne.

La bibliothèque intégrée couvre plusieurs ensembles de contenu dans
différentes langues et domaines. Chaque version en ajoute — voir le
[dépôt d'ensembles](https://github.com/astrapi69/adaptive-learner-content)
pour le catalogue actuel.

---

## Le déroulement d'une leçon

Ouvre un ensemble, choisis une leçon, et le **lecteur de leçons**
te guide pas à pas à travers chaque carte et chaque exercice :

1. **Cartes** : présentent du matériel à lire. Clique sur
   « Suivant » quand tu es prêt.
2. **Exercices** : vérifient ce que tu as retenu. Quatre types
   sont disponibles :
   - **Associer** — fais glisser des paires (mot ↔ traduction).
     Les deux tuiles d'une paire trouvée partagent une **couleur
     propre** et un **badge numéroté**, de sorte que
     l'association est reconnaissable de manière sûre pour le
     daltonisme (pas seulement par la couleur).
   - **Choix d'image** — choisis l'image qui correspond à
     l'indice.
   - **Texte libre** — tape la réponse.
   - **Tuiles de mots** — assemble une phrase à partir de tuiles.
   - **Texte à trous** — remplis un trou dans la phrase (généré de
     manière ciblée à partir de tes erreurs, voir ci-dessous).

Une barre de progression en haut suit ta position dans la leçon.
Tu peux t'arrêter à tout moment — ta progression est enregistrée
par étape et reprend là où tu t'es arrêté.

### Raccourci Entrée

Tu peux piloter toute la leçon au clavier : **Entrée** vérifie un
exercice répondu puis passe à l'étape suivante ; les champs de
texte libre et de texte à trous se valident sur Entrée (pas de
saut de ligne). Les éléments de commande qui ont eux-mêmes besoin
d'Entrée gardent la priorité. Le raccourci est commutable dans
**Paramètres → Apprentissage** (activé par défaut) et s'applique
aussi à la reprise des erreurs (« Répéter les erreurs »).

### Liens d'exemple et de théorie

- **Voir l'exemple :** une étape de théorie peut porter un lien
  optionnel vers un exemple détaillé, qui apparaît sous forme de
  bouton « Voir l'exemple ».
- **Relire la théorie :** un exercice affiche un lien discret vers
  la théorie précédente la plus proche ; de là, « Retour à
  l'exercice » te ramène à la tâche. Tu consultes ainsi une règle
  sans perdre le fil.

### Le récapitulatif

Lorsque le dernier exercice est terminé, le **récapitulatif de la
leçon** apparaît :

- Une **note en étoiles de 0 à 3** basée sur ton résultat :
  - **3 étoiles** ≥ 90 % de réussite
  - **2 étoiles** ≥ 75 %
  - **1 étoile** ≥ 50 %
  - **0 étoile** en dessous de 50 %
- Une **décomposition exercice par exercice**, qui montre quels
  exercices tu as réussis et lesquels contenaient des erreurs
  (avec la bonne réponse pour les faux).
- **Leçon suivante**, **Recommencer** et **Retour à l'ensemble**
  sous forme de boutons, afin que la prochaine action soit à un
  clic.

Si tu obtiens 3 étoiles du premier coup, une petite animation de
célébration se joue. (Si tu as activé le réglage du système
« réduire les animations », l'animation le respecte.)

### Exporter le résultat

Le récapitulatif propose **« Copier le résultat »** et
**« Enregistrer comme fichier »**. Les deux génèrent un **rapport
Markdown** avec ton score, une décomposition erreur par erreur (ta
réponse + la bonne réponse) et les domaines encore faibles. Le
rapport convient pour être collé dans un assistant IA qui doit
t'aider de manière ciblée. L'export est un pur générateur sans
backend et fonctionne dans les deux modes de stockage.

---

## Suivi des erreurs au niveau des éléments

Chaque réponse fausse dans chaque type d'exercice écrit une ligne
qui renvoie à l'**élément concret que tu as manqué** — le mot, la
paire ou la phrase précis. L'application ne retient PAS seulement
« tu as obtenu 6/10 à la leçon 3 » ; elle retient « tu as eu
particulièrement du mal avec *bonjour* et *merci* ».

Si tu réponds correctement au même élément **3 fois de suite**, il
est marqué comme **maîtrisé** — et retiré de la file d'attente de
révision. Si tu réponds plus tard de manière fausse à un élément
maîtrisé, il **redescend** dans la file. Une maîtrise manquée est
une maîtrise oubliée.

---

## La file d'attente de révision

Si tu as un ou plusieurs éléments qui ont besoin d'une révision,
la **carte de révision** apparaît sur le tableau de bord. Elle
montre :

- Combien d'éléments sont à échéance
- Combien sont **en retard** (après la date de révision planifiée)
- Un bouton **Réviser maintenant**, qui ouvre une mini-session
  ciblée sous `/review/:setId`

La planification utilise trois niveaux, en fonction du nombre de
fois où tu as répondu correctement à l'élément de suite :

| Série correcte | Prochaine révision |
|---|---|
| 0 | 1 jour plus tard |
| 1 | 3 jours plus tard |
| 2 | 7 jours plus tard |
| 3 (maîtrisé) | retiré de la file |

Au sein de la file, les entrées se trient ainsi : **les en retard
d'abord**, puis par **nombre d'erreurs décroissant**, puis par
**erreur la plus récente d'abord**. Ainsi, les éléments avec
lesquels tu luttes le plus remontent en haut.

---

## Sessions de révision

Une session de révision sous `/review/:setId` synthétise une
**mini-leçon à la volée** à partir des entrées du haut de ta file.
Stratégie mixte :

- Si tu as manqué un mot à l'origine dans un exercice
  d'**association** ou de **choix d'image**, tu refais exactement
  cet exercice (avec un nouveau mélange — pas de simple mémoire
  musculaire).
- Si tu as manqué quelque chose en **texte libre** ou en **tuiles
  de mots**, la révision essaie de générer un exercice de **texte
  à trous** qui vise exactement le mot manqué. Le même savoir sous
  une autre forme — c'est la flexibilité qui est entraînée, pas
  seulement la répétition d'un format d'exercice particulier.
- Si aucun texte à trous propre ne peut être construit pour un
  élément (p. ex. lorsque l'invite d'origine ne contenait pas la
  réponse dans la phrase), la révision rejoue silencieusement
  l'exercice original. Tu n'obtiens jamais une étape cassée ou
  vide.

Lorsque tu termines une session de révision, la même machinerie
d'évaluation + étoiles + suivi des éléments s'exécute. Maîtrise 50
éléments par la révision et tu gagnes le badge **Maître de la
révision**.

## Tour de correction en fin de leçon

Lorsque tu termines une leçon avec
des erreurs, la page de récapitulatif affiche un petit **tour de
correction** entre ton score et le bouton « Leçon suivante ». Il
prend jusqu'à cinq erreurs concrètes de cette leçon et propose
chacune sous forme de nouveau texte à trous visant exactement le
mot / l'article manqué.

- **Ignorable à tout moment.** Le bouton « Leçon suivante » reste
  visible — le tour de correction est un exercice volontaire, pas
  un verrou.
- **N'apparaît que s'il y a quelque chose à corriger.** Les leçons
  avec un score parfait le sautent entièrement. Les leçons dont
  les erreurs ne peuvent pas être transformées en un texte à trous
  propre (rare) également.
- **Chaque texte à trous terminé compte pour la maîtrise.** Le
  tour de correction écrit les mêmes enregistrements de suivi des
  éléments que la leçon principale ; ta série sur ces éléments
  progresse vers le seuil de maîtrise des 3 réponses correctes.

À la fin, une courte ligne « {n} éléments améliorés » apparaît,
afin que tu voies l'effet de ton exercice supplémentaire.

## Retour visuel par diff

Les réponses fausses de
texte libre et de tuiles de mots affichent désormais une **diff au
niveau des jetons** entre ta saisie et la réponse canonique. Trois
couleurs, jamais la couleur seule :

- **Rouge barré** — ce que tu as écrit et qui n'avait pas sa place
  (avec un marqueur × pour les lecteurs d'écran et les
  utilisateur·rice·s daltoniens).
- **Vert** — ce que la réponse canonique contient et que tu as
  oublié (avec un marqueur +).
- **Jaune** avec flèche → — un mot légèrement faux, présenté sous
  la forme `ton-mot` → `attendu`.

La même diff apparaît dans le récapitulatif de la leçon, dans la
décomposition de chaque exercice — pour chaque réponse de texte
libre ou de tuiles de mots dont la saisie utilisateur est connue
du stockage.

---

## XP et badges

Chaque leçon terminée gagne des XP selon une formule en étoiles :

- **30 XP** de base
- **+10 XP par étoile** obtenue (0 → 0, 1 → +10, 2 → +20, 3 → +30)
- **+20 XP de bonus** si tu obtiens 3 étoiles du premier coup
  (chaque étape avec tentatives = 1, aucune répétition)
- Le même **multiplicateur de série quotidienne** que pour les
  sessions de chat (+25 % par jour consécutif, plafonné à 7 jours)

Quatre nouveaux badges se débloquent autour des leçons :

- **Première leçon** — termine ta première leçon de contenu.
- **10 leçons terminées** — termine 10 leçons de contenu.
- **Série de 3 étoiles** — obtiens trois leçons de suite avec 3
  étoiles.
- **Maître de la révision** — maîtrise 50 éléments par la
  répétition espacée.

Les achèvements de leçon comptent aussi pour ta **série
quotidienne**, de sorte qu'apprendre avec des leçons de contenu
remplit la heatmap de la même manière que les sessions de chat.

---

## Modes de stockage

Les leçons fonctionnent dans les **deux** modes de stockage — API
(backend) et Dexie (navigateur seul / GitHub Pages). Le suivi des
erreurs au niveau des éléments et la planification SRS s'exécutent
à l'identique contre IndexedDB en mode purement navigateur, de
sorte que les utilisateur·rice·s qui visitent le site public
GitHub Pages obtiennent la boucle de révision complète sans
backend.

La gamification est également alignée : en
mode purement navigateur, tu gagnes pour les leçons terminées **les
mêmes XP et badges de leçon** qu'en mode serveur — la logique des
étoiles, des séries et des badges est portée en TypeScript et
sécurisée contre des valeurs de référence identiques. Il n'y a plus
aucune différence de fonctionnalité entre les modes lors de
l'achèvement d'une leçon.

---

## Protection des données

Toute la progression des leçons, les lignes d'erreurs au niveau
des éléments, les états de la file d'attente de révision et les
données de planification restent **sur ton propre appareil** —
dans le système de fichiers (mode API) ou dans le navigateur
(IndexedDB). Rien sur les mots avec lesquels tu luttes n'est envoyé
où que ce soit.
