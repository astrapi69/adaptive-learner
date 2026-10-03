# Paramètres

La page Paramètres rassemble tout ce que vous pouvez régler sans
toucher au code ni au YAML. Elle est organisée en **onglets** :
choisissez un onglet et son panneau s'ouvre, sans avoir à faire défiler
une longue liste de haut en bas. Sur un grand écran, les onglets se
trouvent dans une barre latérale à gauche ; sur un téléphone, ils
s'ouvrent depuis un bouton de menu au-dessus du panneau. L'adresse
nomme l'onglet ouvert (`/settings?tab=data`), si bien qu'un lien ou un
rechargement retombe sur le même onglet ; sans précision, la page
s'ouvre sur **Général**.

Les onglets sont répartis en quatre groupes :

- **Général**
    - **Général** : profil (nom affiché, avatar, cadres d'avatar),
      apparence (thème, affichage du contenu, ordre des onglets du hub
      de contenu), langue d'affichage, interface (infobulles des
      boutons, position du menu sur le téléphone), mode de stockage,
      préférences de mise à jour, installation de l'application et
      indicateur de mode.
- **Apprentissage et IA**
    - **Apprentissage** : le comportement des leçons, en cinq zones
      allant du profil d'apprentissage à la motivation et la routine,
      y compris les réglages de voix et la gamification.
    - **IA** : choix du fournisseur et du modèle, clés API par
      fournisseur avec indication de leur source, et aperçu des
      fournisseurs configurés.
    - **Extensions** : les extensions installées et les réglages du
      Dépôt d'apprentissage.
- **Données et intégrations**
    - **Données** : sources de contenu, synchronisation, contenu hors
      ligne, sauvegarde et export (y compris l'export chiffré des
      clés), nettoyage et zone de danger, avec une barre de sections
      en haut.
    - **Intégrations** : l'intégration GitHub (le token pour partager
      des leçons sous forme de pull request).
- **Infos**
    - **Aide** : le glossaire intégré, avec recherche.
    - **Diagnostic et assistance** : le rapport d'erreur, le mode
      développeur et la sonde de touchers et de viewport.
    - **À propos** : version, informations système, crédits, partage
      de l'application, dons, licence.

## Profil

Sous *Général > Profil*, vous définissez votre **Nom affiché** et
personnalisez votre **avatar** :

- **Importer une image** ouvre la boîte de recadrage ; le résultat
  s'affiche en haut à droite de la navigation.
- **Ou choisissez un personnage** : huit personnages prédéfinis en
  alternative à votre propre photo, un clic suffit. Si une photo
  importée est active, une boîte de dialogue demande confirmation avant
  que le personnage la remplace ; la photo est mise de côté et peut
  être rétablie à tout moment via **Restaurer la photo** (jusqu'à
  l'import d'une nouvelle photo).
- **Cadre d'avatar** : des anneaux décoratifs autour de l'avatar. Le
  bronze, l'argent et l'or se débloquent avec votre niveau, la flamme
  avec le badge de série de 3 jours ; l'étoile et l'accent s'échangent
  contre de l'XP (confirmation en deux étapes, le coût est inscrit sur
  le bouton). Les cadres verrouillés indiquent leur condition.

Votre choix et les cadres achetés sont conservés et voyagent avec votre
[sauvegarde](../features/backup.md).

## Apparence

Le sélecteur de **Thème** sous *Général > Apparence* range les thèmes
dans deux onglets :

- **Recommandés** - Catppuccin Latte, Supabase et Graphite (clairs),
  Catppuccin Mocha, **Soft Pop** et Amethyst Haze (sombres). Les
  nouveaux utilisateurs commencent avec **Soft Pop**, et le sélecteur
  s'ouvre sur cet onglet.
- **Classiques** - les thèmes d'origine : Clair, Sombre, Océan, Forêt,
  Contraste élevé (noir, blanc et couleurs de signal franches avec des
  bords de carte nets, pour une lisibilité maximale) et Sépia (tons de
  papier chauds pour les longues lectures). Si votre thème actif est un
  thème classique, le sélecteur s'ouvre sur cet onglet.

Les deux onglets proposent aussi **Auto (système)**, qui suit le
réglage clair/sombre de votre système d'exploitation et bascule
automatiquement quand celui-ci change.

Choisissez un thème depuis sa carte d'aperçu ; le changement
s'applique immédiatement, sans rechargement, et votre choix est
mémorisé d'une visite à l'autre. Chaque thème est conçu pour respecter
le contraste WCAG 2.1 AA, de sorte que le texte, les graphiques, les
badges et les retours des exercices restent lisibles dans tous.

Cette carte contient aussi l'**Affichage du contenu** : la préférence
globale *liste / grille* pour le hub de contenu (par défaut **liste**).
C'est la même préférence que le commutateur de vue dans les onglets
*Mon contenu* / *Découvrir*, si bien qu'un changement à l'un des deux
endroits garde les deux synchronisés. Juste sous la carte, vous réglez
l'**ordre des onglets du hub de contenu** (Découvrir / Mon contenu /
Importer / Créer), pour que le hub s'ouvre sur l'onglet que vous
utilisez le plus.

## Langue

*Général > Langue* change à la volée chaque texte de l'interface au
rendu suivant, via `PATCH /api/settings/{user_id}`. Les 11 langues
sont toutes de premier rang - DE / EL / EN / ES / FR / HI / ID / JA /
KO / PT / TR - chacune avec un catalogue entièrement traduit. Le choix
est conservé d'un rechargement à l'autre via `localStorage`.

## Interface

*Général > Interface* propose deux réglages : **Afficher les
infobulles des boutons** (une infobulle au survol des boutons à icône ;
les libellés pour lecteurs d'écran restent présents dans tous les cas)
et la **Position du menu (mobile)** sur le téléphone (en haut sous
forme de bouton de menu, par défaut, ou en bas sous forme de barre
d'onglets à portée du pouce). Les gestes de balayage sont un réglage
de leçon et se trouvent sous *Apprentissage > Pendant la leçon >
Interaction*. Le mode développeur se trouve dans l'onglet
**Diagnostic et assistance** (voir plus bas).

## Mode de stockage

*Général > Mode de stockage* bascule entre le stockage **Serveur** et
**Local (Navigateur)** :

- **Serveur** - chaque lecture et écriture passe par le backend
  FastAPI. Nécessite un backend en cours d'exécution. Idéal pour un
  usage sur plusieurs appareils avec synchronisation côté backend.
- **Local (Navigateur)** - chaque lecture et écriture passe par
  IndexedDB dans ce navigateur. Les appels IA partent directement vers
  le fournisseur. Aucun backend nécessaire. Idéal pour une
  configuration privée, limitée à l'appareil.

Le changement de mode est enregistré dans `localStorage` et affiche un
avis indiquant qu'un rechargement est nécessaire. Les données ne sont
PAS synchronisées entre les modes.

La version web publique et l'application web installée n'ont pas de
backend ; la carte y est donc absente et l'application utilise
toujours Local (Navigateur).

## Mises à jour et installation de l'application

Le reste de l'onglet **Général** concerne le fonctionnement de
l'application :

- **Mises à jour** (mode Serveur uniquement) : **Vérification
  automatique des mises à jour** et **Intervalle de vérification**
  (Quotidien, Hebdomadaire, Mensuel ou Jamais), ainsi que l'heure de la
  dernière vérification et la version actuelle. Le bouton manuel
  **Rechercher des mises à jour** se trouve dans l'onglet **À propos**.
- **Installer l'application** : installe Adaptive Learner comme
  application autonome (fenêtre dédiée, icône sur l'écran d'accueil,
  démarrage sans réseau). Une fois l'installation faite, le bouton
  affiche **Déjà installée**.
- **Mode** : le Mode solo est actif ; le Mode multijoueur est signalé
  comme à venir.

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
non affichée (la zone de voix dans un navigateur sans Web Speech) n'a
pas de puce, et une section inconnue est ignorée. Pendant le
défilement, la puce mise en évidence suit la zone affichée à l'écran.

### Bases

Qui apprend, et dans quelles langues.

- **Profil d'apprentissage** - créer, poursuivre ou refaire le profil
  d'apprentissage derrière les poids des six méthodes.
- **Langues source supplémentaires** - les langues source que l'arbre
  de contenu affiche en plus de votre langue d'application.

### Pendant la leçon

Comment les exercices se comportent pendant que vous répondez.

- **Mode de leçon** - le **Mode par défaut** (Entraînement / Examen /
  Chronométré), le **Seuil de réussite** de l'examen et la
  **Difficulté du mode chronométré** (Rapide, Normal, Détendu) ; voir
  [Leçons de contenu et révisions](lessons.md).
- **Indices** - si un bouton d'indice par paliers apparaît sur chaque
  exercice, et le **coût en XP par indice** (0 pour des indices
  gratuits).
- **Interaction** - les **gestes de balayage** (balayer pour naviguer
  dans l'Évaluation, la Session et le Programme ; activés par défaut sur
  les appareils tactiles), les **Raccourcis clavier dans les leçons**
  (Entrée vérifie la réponse, Entrée à nouveau passe à la suite), le
  **passage automatique après une bonne réponse** et l'affichage du
  bouton **Demander à l'IA**.
- **Direction d'exercice préférée** - la direction par laquelle
  s'ouvrent les exercices directionnels.
- **Exercice d'association** - **Correction dans une vue séparée**
  (activé par défaut) : après la vérification, « Mes réponses » ne
  montre que vos propres paires avec vos erreurs, les bonnes réponses
  sont sous « Correction », la solution sous « Résoudre ». Désactivé :
  la bonne réponse s'affiche directement sous chaque erreur dans « Mes
  réponses ». S'y ajoute l'**Animation de résolution**, l'effet joué
  quand un exercice d'association est résolu.

### Lecture à voix haute et dictée

Voix, vitesse, microphone et entraînement à la prononciation. La zone
contient la carte **Voix** :

- **Afficher les boutons de lecture** - ajoute un bouton haut-parleur à
  côté des réponses de l'IA et des résultats de l'Évaluation, qui les
  lit à voix haute.
- **Lire automatiquement les réponses IA** - lit chaque réponse de l'IA
  automatiquement (désactivé par défaut - un son inattendu est rarement
  souhaité).
- **Voix** - la voix utilisée pour la lecture ; par défaut, la plus
  proche de la langue de votre projet est choisie.
- **Vitesse** et **Hauteur** - curseurs de 0,5 à 2.
- **Afficher le bouton micro** - ajoute un bouton microphone au champ
  de saisie de la Session, qui capte la parole et remplit la zone de
  texte avec des transcriptions intermédiaires avant l'envoi.
- **Langue de dictée** - un code BCP-47 (par exemple `fr-FR`) ;
  laissez-le vide pour utiliser la langue du projet ou de l'interface.
- **Pratique de Prononciation** - affiche un bouton *Pratique de
  Prononciation* sur les tableaux de bord des projets d'apprentissage
  des langues.

Les réglages de lecture à voix haute (les cinq premiers) n'apparaissent
que si le navigateur prend en charge la synthèse vocale, les deux
réglages de dictée seulement s'il prend en charge la reconnaissance
vocale. Si le navigateur ne prend en charge aucun des deux côtés de la
Web Speech API, toute la zone est absente, titre compris, et *Après la
leçon* suit directement *Pendant la leçon*.

### Après la leçon

Séances de révision, résumé de la leçon et reprise des erreurs.

- **Révision** - les explications après la réponse (l'explication
  rédigée par l'auteur d'un exercice, affichée sous l'exercice une fois
  vérifié, et les conseils de règle générés automatiquement après une
  leçon) et le nombre de questions par séance de révision. Le
  commutateur « Réviser aussi les éléments sans erreur » (désactivé par
  défaut) décide si la révision ne contient que les éléments avec des
  erreurs ou ramène aussi, après 3 et 7 jours, des éléments que vous
  n'avez jamais ratés. La carte se termine par le bloc en lecture seule
  **Répétition espacée** : le calendrier des intervalles (bonnes
  réponses d'affilée contre jours avant la prochaine révision), à
  partir de quand un élément compte comme maîtrisé, et un lien vers la
  méthode d'apprentissage.
- **Résumé après les leçons** - les sections que le résumé de fin de
  leçon affiche, et dans quel ordre. Seuls *Résultat et statistiques*
  et *Récompense d'XP* sont activés par défaut, la vue compacte qui
  tient sur un écran de téléphone ; tout le reste s'affiche via le
  bouton *Évaluation détaillée* à la fin d'une leçon, ou vous le cochez
  ici durablement. *Pourquoi tu les as ratés* fait partie de ces
  sections ; son interrupteur principal reste *Afficher les
  explications* sous *Révision*.
- **Revoir les erreurs** - les erreurs que la reprise récupère.

### Motivation et routine

Mode jeu, retour, missions quotidiennes et rappels.

- **Mode jeu** - les leçons ludiques, y compris la **Variante de la
  mascotte**, des jeux de couleurs pour la mascotte qui se débloquent
  avec les niveaux et les badges ou en échange d'XP (les variantes
  verrouillées indiquent leur condition, les achats demandent une
  confirmation en deux étapes). Ce que le mode jeu change en détail est
  décrit dans [Célébrations et encouragements](celebrations.md).
- **Retour** - l'intensité du retour et les sons (volume, bouton
  Tester).
- **Missions quotidiennes** - si les missions sont actives, combien par
  jour, le mélange de difficulté et le remaniement des missions du jour.
- **Rappels** - l'heure du rappel et les jours où il s'applique.
- **Ludification** - les notifications XP / badge, le mode week-end,
  l'objectif de sessions quotidien et *Réinitialiser la progression* ;
  la dernière carte, voir ci-dessous.

La carte du mode jeu affiche l'interrupteur principal, les sons du mode
jeu et une ligne d'état indiquant combien d'options sont activées.
**Détails du mode jeu** (cœurs, compte à rebours, arcade, manches
spéciales, tickets, leçons bonus, XP de série et mascotte) est replié
et mémorise votre choix ; tant que **Leçons ludiques** est désactivé,
les options qu'il contient sont grisées.

L'onglet se termine par **Ludification** (sous un séparateur, parce que
cette carte contient *Réinitialiser la progression*). Les deux réglages
de nettoyage, *Leçons en pause sur le tableau de bord* et *Taille
maximale de leçon*, concernent le cycle de vie des données et se
trouvent dans l'onglet **Données** (voir *Contenu hors
ligne* et *Nettoyage* sous Données).

L'**Affichage du contenu** (liste / grille) et l'**ordre des onglets du
hub de contenu** se trouvent dans l'onglet **Général**, sous
*Apparence*.

### Ludification

Des commutateurs pour les notifications XP / badge / passage de niveau
(désactivés, ils suppriment les notifications mais le système
enregistre toujours l'état), le **mode week-end** (ignore les trous du
samedi et du dimanche dans la carte de chaleur des séries), l'objectif
de sessions quotidien (1..10) et **Réinitialiser la progression**
(double confirmation ; efface les lignes `user_xp` + `user_badges` +
`user_streaks`).

## Fournisseur et choix du modèle

Dans l'onglet **IA**, la liste déroulante des fournisseurs écrit
`active_provider` dans UserSettings ; l'appel IA suivant passe par
l'extension du nouveau fournisseur (mode Serveur) ou par le client HTTP
du nouveau fournisseur (mode Local).

Le **sélecteur de modèle** est une liste déroulante avec recherche,
groupée en Recommandé / Tous, alimentée par l'endpoint `/v1/models` en
direct de chaque fournisseur (cache d'une heure). Chaque ligne affiche
le nom lisible, l'identifiant brut et un badge de fenêtre de contexte.
Quand la liste découverte n'est pas disponible (pas de clé API, pas de
réseau), le sélecteur revient aux valeurs par défaut statiques et
l'indique. L'en-tête de la Session affiche `<Fournisseur>: <Nom du
modèle>` ; l'identifiant complet et la fenêtre de contexte figurent
dans l'infobulle.

## Clés API

Chaque fournisseur a sa propre ligne : un champ de saisie de la clé,
un bouton Enregistrer, un bouton Supprimer, le badge du fournisseur
actif, ainsi que le badge d'**origine de la clé** :

- **Clé depuis : secrets.yaml** - la clé est stockée chiffrée (Fernet)
  dans `~/.config/adaptive_learner/secrets.yaml`. C'est là que le mode
  Serveur enregistre chaque clé saisie ici, donc après un
  enregistrement la ligne affiche ce badge. Enregistrer et Supprimer
  restent disponibles ; enregistrer remplace la clé stockée. Une ligne
  d'information sous la ligne indique le chemin.
- **Clé depuis : Paramètres** - une ancienne clé encore dans la base de
  données, datant d'avant le passage des clés à `secrets.yaml` ; elle y
  est déplacée au prochain démarrage. En mode Local (navigateur), la
  clé vit dans IndexedDB et affiche aussi ce badge. Enregistrer et
  Supprimer librement.
- **Clé depuis : environnement** - la clé est configurée via la
  variable d'environnement `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
  Enregistrer et Supprimer sont désactivés ; la variable
  d'environnement fait foi.
- **Aucune clé configurée** - rien n'est défini nulle part. Saisissez
  une clé et enregistrez pour commencer.

Ordre de résolution (la priorité la plus haute l'emporte) :
environnement > secrets.yaml > base de données. Voir [la documentation
de configuration](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
pour le détail complet.

Les champs de clé utilisent une **saisie masquée** (avec un bouton
afficher/masquer) et ne déclenchent pas le gestionnaire de mots de
passe du navigateur.

Les clés API sont volontairement **exclues** de la sauvegarde normale
(`.alb`). Pour emporter vos clés vers un autre appareil ou navigateur,
utilisez l'**export chiffré des clés (`.alk`)** dédié : un **bouton de
renvoi** dans l'onglet IA mène directement à lui dans l'**onglet
Données** (voir *Export chiffré des clés (.alk)*).

## Fournisseurs configurés

Un aperçu **Fournisseurs d'IA configurés** liste les fournisseurs d'IA
que vous avez configurés, chacun avec un **aperçu masqué de la clé**,
pour voir d'un coup d'œil lesquels sont prêts. Chaque ligne a un bouton
**Tester** qui appelle l'endpoint de liste des modèles du fournisseur
et indique : ok / clé invalide / limite de débit / erreur réseau. Une
vérification sans risque, qui ne consomme pas de jetons de génération.

## Extensions

L'onglet **Extensions** contient deux cartes. **Extensions installées**
liste chaque extension chargée par l'application de bureau : nom,
version, source (paquet ou enregistrement direct) et heure
d'activation. Une erreur de chargement ou un filtre de découverte
apparaît comme marqueur sur la ligne, de même qu'une configuration
modifiée après l'activation. En mode navigateur, la carte reste visible
avec la mention que seule l'application de bureau possède un hôte
d'extensions. **Dépôt d'apprentissage** regroupe les réglages de cette
extension (persistance git, dossier du dépôt).

## Données

L'onglet **Données** regroupe ses cartes en six zones, dans un ordre
fixe : d'où vient le contenu, ce qu'il en advient, ce qui en résulte,
comment vous le sécurisez, ce que vous pouvez nettoyer, et enfin ce qui
est irréversible. Chaque zone porte un petit titre et une description
d'une ligne.

Une **barre de sections** au-dessus des zones les liste sous forme de
puces : *Sources*, *Synchronisation*, *Contenu hors ligne*,
*Sauvegarde et export*, *Nettoyage* et *Zone de danger*. Elle
fonctionne comme celle de l'onglet Apprentissage : un clic saute à la
zone, sur un ordinateur la barre reste visible sous l'en-tête de
l'application, la puce mise en évidence suit la zone affichée à
l'écran, et l'adresse la reflète (`/settings?tab=data&section=backup` ;
identifiants : `sources`, `sync`, `offline`, `backup`, `cleanup`,
`danger`).

### Sources

- **Dépôts de contenu** - les dépôts d'où viennent vos leçons ; voir
  [Dépôts de contenu](../features/content-repos.md).
- **Enregistrez votre dépôt** - propose votre propre dépôt de contenu
  pour l'annuaire partagé qu'utilise la recherche multi-dépôts.

### Synchronisation

Associez cet appareil à un autre sur votre réseau local avec le
lecteur de QR code (caméra arrière) ou en collant l'URL d'association.
Une fois associés, les boutons d'envoi et de réception échangent les
données dans les deux sens. Les conflits passent par un outil de
fusion IA sur le backend.

Solution de repli pour les navigateurs restreints : importez une
capture d'écran du QR code de votre autre appareil
(`Html5Qrcode.scanFile`).

La synchronisation nécessite l'application de bureau. En mode
navigateur, la zone reste visible, mais ses commandes sont remplacées
par l'avis « Disponible uniquement avec l'application de bureau. »

### Contenu hors ligne

- **Cache hors ligne** - la taille et le nombre de leçons du cache de
  leçons hors ligne, avec un bouton pour le vider (demande
  confirmation).
- **Taille maximale de leçon** - lorsqu'une longue analyse de
  conversation est enregistrée comme leçon hors ligne, les leçons de
  plus de ce nombre d'étapes sont découpées en plusieurs parties.
  *Étapes par partie* : de 5 à 20 ; par défaut 10.

### Sauvegarde et export

**Sauvegarde** propose trois actions : **Créer une sauvegarde**
(télécharge un fichier de sauvegarde `.alb`), **Restaurer depuis une
sauvegarde** (restaure à partir d'un fichier) et **Comparer** (diff
côte à côte avec l'état actuel). Les clés API sont retirées de chaque
export.

La restauration est une FUSION, pas un écrasement : les nouvelles
lignes sont insérées, les lignes modifiables sont mises à jour si leur
`updated_at` est plus récent, les lignes d'historique (sessions /
commits / évaluations) sont dédoublonnées par UUID. L'aperçu de
comparaison affiche par table les ajouts / suppressions / modifications
avant que vous cliquiez sur Restaurer ; le libellé du bouton indique
« Restaurer (N ajoutées, M mises à jour) » une fois le diff établi.

En mode Local, la carte affiche aussi le bloc **Sauvegarde
automatique** : un anneau tournant de 3 instantanés dans une base
IndexedDB séparée, déclenché toutes les 10 sessions OU tous les 7 jours
(selon ce qui arrive en premier). Chaque instantané a ses propres
boutons Restaurer, Supprimer et Comparer comme A/B.

Autres cartes de cette zone :

- **Fichier d'identité** (mode Serveur uniquement) - une vue en lecture
  seule du fichier de récupération que conserve le backend, pour voir
  s'il existe et où il se trouve.
- **Export chiffré des clés** - voir ci-dessous.
- **Export de données** - une sauvegarde complète en un clic, ou un
  export sélectif où vous cochez les catégories de données à inclure ;
  les deux produisent le même fichier de sauvegarde importable.
- **Exporter** - trois rapports : *Progression de l'apprentissage*,
  *Détail de la session* et *Programme*, chacun en Markdown ou en PDF
  (via la boîte d'impression du navigateur).

#### Export chiffré des clés (.alk)

La sauvegarde normale retire vos clés API, ce qui est sûr mais vous
obligerait, lors d'un changement d'appareil ou de navigateur, à
ressaisir chaque clé à la main. L'**export chiffré des clés** (carte
« Clés d'IA - export chiffré ») comble ce manque avec un fichier
séparé, protégé par une phrase secrète :

- Il ne contient **que** les identifiants sensibles : vos **clés API**
  plus les réglages des fournisseurs (fournisseur actif, surcharges de
  modèle). Il ne contient PAS le reste de vos données (celles-ci restent
  dans la sauvegarde `.alb`).
- **Exporter** demande une phrase secrète (avec confirmation) et
  télécharge un fichier **`.alk`** dédié. Les clés qu'il contient sont
  chiffrées en **AES-GCM-256**, la clé étant dérivée de votre phrase
  secrète via **PBKDF2** : le fichier ne contient jamais de clé en
  clair.
- **Importer** lit un `.alk`, demande la phrase secrète, déchiffre et
  réécrit les clés et les réglages des fournisseurs dans le même
  stockage sécurisé que la saisie manuelle (les fournisseurs présents
  sont écrasés, les absents laissés tels quels).
- Une **phrase secrète erronée ou un fichier altéré** est rejeté
  proprement avec un seul message et **aucun import partiel** : rien
  n'est écrit à moitié.
- Les champs de phrase secrète sont validés **en direct** pendant la
  saisie : une phrase trop courte ou une confirmation différente est
  signalée directement au champ (et le bouton d'envoi reste désactivé)
  au lieu d'un message d'erreur après le clic. Comme les champs de clé
  API, ces champs ne déclenchent **pas** le gestionnaire de mots de
  passe du navigateur.

Cet export se trouve dans l'**onglet Données**, à côté de la sauvegarde
normale ; l'**onglet IA** ne porte qu'un bouton de renvoi qui vous
amène ici. En **mode Local (navigateur)**, les clés vivent dans
IndexedDB, l'export est donc pleinement disponible (c'est le cas
d'usage principal). En **mode Serveur**, les clés sont gérées côté
serveur et le client ne voit jamais le texte en clair : l'entrée est
donc **désactivée avec une explication**. L'export est aussi désactivé
tant qu'aucune clé exportable n'est configurée.

### Nettoyage

- **Leçons en pause sur le tableau de bord** : la carte des leçons en
  pause du tableau de bord n'affiche que les leçons mises en pause dans
  ce délai (*Masquer les leçons en pause de plus de* 7, 14, 30 ou
  60 jours, ou *Jamais* ; par défaut 30 jours). Une leçon plus ancienne
  disparaît seulement de la carte : rien n'est abandonné, et elle garde
  sa position et ses réponses. La carte affiche les cinq leçons mises en
  pause le plus récemment.
- **Contenu déconnecté** (mode navigateur) : la progression dont le
  dépôt de contenu n'est plus connecté reste masquée jusqu'à ce que
  vous la supprimiez ici. La carte n'apparaît que s'il y a quelque
  chose à nettoyer.

*Taille maximale de leçon* et *Leçons en pause sur le tableau de bord*
sont enregistrées dans ce navigateur et s'appliquent en mode Serveur
comme en mode Local.

### Zone de danger

La dernière zone, visuellement séparée : **Tout réinitialiser** supprime
toutes vos données (sur le backend en mode Serveur, dans ce navigateur
en mode navigateur). Elle propose d'abord de créer une sauvegarde, puis
demande confirmation, et le bouton final **Supprimer définitivement**
ne se déverrouille qu'après la saisie de `RESET`.

## Intégrations

L'onglet **Intégrations** contient l'**Intégration GitHub** : un token
GitHub (avec l'autorisation `repo`) qui permet à l'application de
partager des leçons sous forme de pull request. Le champ du token
vérifie le format pendant la saisie, **Tester** vérifie le token et
affiche le compte auquel il appartient, et une ligne d'origine indique
où le token est stocké (secrets.yaml, une variable d'environnement ou
ce navigateur), avec **Supprimer** pour l'effacer. Un token issu d'une
variable d'environnement ne peut pas être modifié ici.

## Aide

L'onglet **Aide** contient le glossaire intégré : un champ de recherche
filtre les entrées par titre et par texte, et les entrées sont
regroupées en *Concepts clés*, *Méthodes d'apprentissage*, *Étapes du
cycle* et *Fonctionnalités de l'app*. Un clic sur une entrée ouvre
l'article complet dans le panneau d'aide.

## Diagnostic et assistance

L'onglet **Diagnostic et assistance** rassemble ce qui aide le
développeur à voir ce qui s'est passé sur votre appareil :

- **Assistance** - **Créer un rapport d'erreur** rassemble vos actions
  récentes dans un rapport que vous relisez avant que quoi que ce soit
  ne quitte votre navigateur.
- **Mode développeur** - affiche le détail technique complet (code
  d'état, endpoint, trace) dans les messages d'erreur, et un badge
  « DEV » dans la barre de navigation tant qu'il est actif. Sa valeur
  par défaut dépend de la branche de build : il est **activé par défaut
  sur la branche Latest (préversion)** et **désactivé sur Main**, si
  bien que les testeurs de la préversion voient le détail technique
  complet des erreurs, tandis que les utilisateurs en production
  reçoivent des messages conviviaux. Vous pouvez le basculer dans les
  deux sens.
- **Sonde de touchers et de viewport** - enregistre les positions des
  touchers et les changements de viewport dans un protocole persistant
  tant qu'elle est active, pour cerner des bugs d'affichage difficiles
  à reproduire. **Afficher la barre de mesure** affiche ou masque la
  barre en haut pendant que l'enregistrement continue ; **Bouton
  flottant pour la barre de mesure** ajoute un bouton flottant (avec
  choix du coin) qui bascule la barre. **Copier le protocole** et
  **Effacer le protocole** agissent sur les événements enregistrés, et
  un compteur indique leur nombre.

## À propos

Cinq blocs en lecture seule : **Version** (version canonique issue de
`pyproject.toml`, hash et date de build), **Système** (mode de
stockage, dossier de données, chemin de la base en mode Serveur,
informations Python et plateforme), **Crédits** (auteur,
remerciements aux dépendances), **Soutenir le développement** (liens
Liberapay / GitHub Sponsors / Ko-fi), **Licence et ressources** (lien
vers la licence MIT, dépôt, documentation, suivi des tickets).

En mode Local, le panneau masque les lignes qui n'ont de sens qu'avec
un backend en cours d'exécution (version de Python, versions de
FastAPI / SQLAlchemy / Pydantic / PluginForge, chemin de la base).

### Branche de build : Main ou Latest

Adaptive Learner tourne sur deux branches de déploiement, et l'onglet
À propos indique laquelle vous utilisez :

- **Main** - le site de production stable
  (`https://astrapi69.github.io/adaptive-learner/`). Affiché par un
  badge discret, sans style d'avertissement.
- **Latest** - le site de préversion construit depuis `develop`
  (`https://astrapi69.github.io/adaptive-learner-content-test/`).
  Affiché par un badge **version de test** bien visible, pour que vous
  sachiez qu'il peut contenir des bugs.

Le badge montre la branche de déploiement avec la branche git et le
hash de commit court. Il s'appuie sur les informations de build
intégrées au moment du build ; une heuristique sur l'URL n'est qu'un
repli clairement signalé, et une information manquante s'affiche comme
« inconnue » plutôt que d'être devinée.

### Partager l'application

L'onglet À propos propose une entrée **Partager l'application** qui
affiche un **QR code** scannable de l'URL publique de l'application,
avec les actions copier / télécharger en PNG / partage natif, pratique
pour installer l'application sur un téléphone.

Sur la branche **Latest**, le partage propose l'URL de préversion
**uniquement sous forme de lien, sans QR code**, accompagnée d'un
avertissement d'instabilité, afin qu'un code scanné ne puisse jamais
envoyer quelqu'un vers la version de test instable à son insu. Sur
**Main**, le partage fonctionne comme avant, avec le QR code de l'URL
de production.

### Rechercher des mises à jour

Un bouton **Rechercher des mises à jour** dans le bloc Version compare
votre version à la dernière release GitHub. La version de bureau
exécute en plus une **vérification automatique des mises à jour** via
l'API GitHub Releases et vous prévient quand une version plus récente
est disponible ; son intervalle se règle dans l'onglet **Général**
sous *Mises à jour*. Après une mise à jour de la PWA, la bannière
« nouvelle version disponible » reste masquée une fois acceptée (elle
ne réapparaît plus à chaque rechargement).
