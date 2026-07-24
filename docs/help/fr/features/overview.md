# Aperçu des fonctionnalités

Cette page est la réponse canonique à la question « que sait faire
Adaptive Learner exactement ? ». Elle liste toutes les capacités
majeures de l'app visibles pour l'utilisateur, groupées par thème, et
est maintenue à jour à chaque release. Les autres endroits (README,
les pages d'aide individuelles) renvoient ici au lieu de maintenir
leurs propres copies de cette liste.

## Cœur d'apprentissage

- **Six méthodes d'apprentissage** (déductive, inductive, basée sur
  l'erreur, dialogique, contextuelle, adaptative par IA) avec des
  prompts IA dédiés par méthode et par étape.
- **Cycle de session en sept étapes** : input, focus, essai, feedback,
  affinage, transfert, intégration. Un évaluateur à double prompt juge
  chaque tour et décide d'avancer, de répéter, de sauter en avant ou
  de revenir en arrière.
- **Auto-loop** : quand un sujet est intégré, la session choisit un
  nouveau sous-sujet et démarre un cycle frais (plafonné par session).
- **Changement de méthode** : la détection de stagnation recommande
  une autre méthode quand les évaluations plafonnent ; acceptation en
  un clic.
- **Test d'évaluation de positionnement** (optionnel, reprenable) qui
  calcule un profil d'apprentissage à six méthodes ; un démarrage
  rapide à deux champs fonctionne aussi sans lui.

Voir [Sessions d'apprentissage](../user-guide/learning-session.md) et
[La méthode d'apprentissage](../concept/philosophy.md).

## Chat tuteur IA

- **Chat de session basé sur assistant-ui** : réponses en streaming
  token par token, rendu Markdown, theming et localisation complète.
- **Voix** : dictée au micro dans le chat, lecture à voix haute des
  réponses et un mode dédié de pratique de la prononciation.
- **Bring your own key** : Anthropic Claude, OpenAI GPT et Google
  Gemini comme plugins fournisseurs séparés ; découverte des modèles
  en direct avec un sélecteur Recommandés/Tous ; test de clé par
  fournisseur et un coffre de clés avec rollback.
- **Les conversations importées se poursuivent comme sessions de
  tuteur**, en conservant le sujet d'origine et le contexte
  d'analyse.
- **« Demander à l'IA »** sur les blocs de théorie et les exercices,
  et des réponses IA toujours dans la langue d'interface de
  l'apprenant.

## Types d'exercices

Six types de base que chaque ensemble peut utiliser, plus cinq types
d'extension qu'un ensemble peut apporter :

| Type de base | Ce que fait l'apprenant |
|---|---|
| Association | Apparier des termes entre deux colonnes (départ possible des deux côtés) |
| Choix d'image | Choisir l'image qui correspond |
| Texte libre | Taper la réponse (tolérance aux fautes de frappe, plusieurs réponses acceptées, seconde opinion IA optionnelle) |
| Texte à trous | Remplir les trous en tapant, en choisissant ou en sélection multiple |
| Tuiles de mots | Composer la réponse à partir de tuiles mélangées (glisser tactile) |
| Choix multiple | Réponse simple ou multiple |

| Type d'extension | Ce que fait l'apprenant |
|---|---|
| Catégorisation | Trier des éléments dans des catégories |
| Correction d'erreurs | Trouver et corriger l'erreur dans une phrase |
| Compréhension écrite | Lire un texte, répondre à des questions |
| Quiz noté | Un mini-quiz avec score |
| Dictée audio | Écouter et taper ce qui a été dit |

- Les exercices sont **sensibles à la direction** (reconnaître vs
  produire), affichent un **indicateur de difficulté par exercice**,
  prennent en charge les **contenus code et formule** avec coloration
  syntaxique et proposent des variantes **Écoute d'abord**.
- Les réponses fausses reçoivent un **feedback de diff au niveau du
  token** ; les indices sont progressifs et coûtent des XP.

Voir [Leçons](../user-guide/lessons.md) pour la vue de l'apprenant.

## Leçons et mécanique d'apprentissage

- **Sept manières de jouer une leçon ou un ensemble** : Entraînement,
  Examen (feedback différé, verdict réussi/échoué, bonus d'XP),
  Chronométré, Inversé, Aléatoire, Infini et un mode « Entraîner les
  erreurs » à débloquer, qui ne rejoue que ce qui a raté.
- **Répétition espacée (SRS)** sur l'historique d'erreurs par
  élément : file de révision des échéances, maîtrise sensible à la
  direction, boost d'intervalle en mode examen et longueur de session
  de révision configurable.
- **Leçons adaptatives** générées à la demande à partir de tes
  propres schémas d'erreurs (basées sur des règles, hors ligne,
  aucune clé d'API requise).
- **Refaire les erreurs et un tour de correction** en fin de leçon
  travaillent exactement les mots que tu as ratés.
- **Contrôle du flux de leçon** : mettre en pause, reprendre à
  l'étape exacte, sauvegarde automatique et un widget des leçons en
  pause sur le tableau de bord.
- Notes en étoiles de 0 à 3, favoris, suggestions d'étapes
  suivantes, découpage automatique des leçons trop grandes et liens
  de retour vers la théorie depuis les exercices.

## Création de leçons (Create-Lesson)

- **Un assistant sans clé d'API** construit une leçon complète et
  partageable : éditeur de cartes avec glisser-déposer et import CSV,
  téléversement d'image par carte, modèles, enregistrement
  automatique du brouillon et aperçu dans le véritable lecteur de
  leçons.
- **Chaque exercice est modifiable** : tous les types de base
  peuvent être édités après la génération, ajoutés à la main et
  équilibrés ; un **assistant de rédaction d'extensions** couvre les
  cinq types d'extension, y compris le téléversement d'un fichier
  audio pour la dictée.
- **Ingestion de texte de livre** : coller du texte de manuel, ou
  téléverser un fichier de livre (EPUB, DOCX, TXT, Markdown) avec un
  sélecteur de chapitres, la sélection multiple des sections
  détectées, une heuristique automatique d'exclusion des pages
  liminaires et finales et la génération de leçons par lot, section
  par section.
- **Génération d'exercices par IA** (avec ta propre clé) avec un
  quality gate déterministe, la régénération avec feedback et la
  génération par lot pour un ensemble entier.
- **Gérer tes propres leçons** : modifier chaque leçon d'un ensemble
  multi-leçons via un sélecteur de leçon, regrouper tes leçons dans
  un ensemble et choisir un domaine de contenu (langues plus domaines
  de connaissances).

Voir [Créer des leçons](../content-creation/overview.md).

## Import et analyse

- **Import d'historiques de chat** depuis ChatGPT, Claude, Gemini
  ainsi que depuis du Markdown quelconque ou du texte collé.
- **L'analyse IA** extrait le sujet, les faiblesses, les schémas
  d'erreurs, la méthode recommandée, le vocabulaire et une
  proposition de programme.
- Un clic amorce un **programme**, démarre une **session ciblée** ou
  convertit l'analyse en une **leçon hors ligne rejouable**.

## Gestion de contenu

- **Hub de contenu** avec les onglets Découvrir / Mes contenus /
  Importer, vue liste ou grille et une barre de recherche et de
  filtres (langue, niveau, domaine, confiance, Vérifié par IA).
- **Ensembles de leçons téléchargeables** depuis des dépôts de
  contenu GitHub publics, mis en cache pour l'usage hors ligne ; des
  ensembles peuvent être masqués via un drapeau de visibilité du
  manifeste.
- **Dépôts fédérés** : connecter plusieurs dépôts de contenu propres
  ou tiers (dépôts privés via token), une section de dépôts
  recommandés et des badges de confiance par source.
- **Partage communautaire** : un assistant de partage en quatre
  étapes ouvre une vraie pull request contre un dépôt de contenu,
  avec placement intelligent et détection des doublons ; des codes
  d'invitation permettent le partage privé pour les coachs.
- **Liens profonds et QR codes par ensemble**, une vue parcours
  d'apprentissage avec maîtrise par ensemble, des recommandations de
  livres par domaine et une section livre d'accompagnement par
  ensemble.

Voir [Navigateur de contenu](content-browser.md),
[Découvrir du contenu](discover.md) et
[Dépôts de contenu](content-repos.md).

## Gamification

- **XP et niveaux** avec un badge XP visible et des récompenses par
  leçon.
- **Catalogue de badges à paliers** (bronze/argent/or ; les badges
  verrouillés restent visibles avec un indice de déblocage).
- **Séries** avec heatmap, et des **missions quotidiennes** (jusqu'à
  trois objectifs adaptatifs par jour).
- **Célébrations** : des éloges mérités, à intensité réglable, des
  overlays de jalons, des sons optionnels, le tout compatible avec la
  réduction des animations.

## Exports et sauvegarde

- **Anki** : flashcards extraites par IA, relues dans l'app,
  exportées en `.apkg` ou `.txt`.
- **NotebookLM** : un ZIP avec résumé, vocabulaire, règles, erreurs,
  flashcards et sessions, plus des questions de rappel actif et un
  guide d'étude.
- **Dépôt d'apprentissage** : artefacts Markdown par projet (README,
  statistiques, antisèche, feuille de route), téléchargeables en ZIP
  ou committés via Git en mode serveur.
- **Rapports de progression** en Markdown ou PDF ; résultats de leçon
  exportables pour continuer à pratiquer avec une IA ; feuille de
  partage native pour les résultats.
- **Sauvegardes** : sauvegarde ZIP `.alb` couvrant toute la surface
  de données, enregistrement sur disque, restauration au premier
  démarrage, migration en-ligne-vers-local et un export `.alk`
  séparé, chiffré par phrase secrète, pour les clés IA.

Voir [Sauvegarde et restauration](backup.md).

## Plateforme

- **Progressive Web App** : installable, utilisable hors ligne, mises
  à jour par service worker avec bannière de mise à jour, fonctionne
  entièrement dans le navigateur.
- **Deux modes de stockage** : local d'abord (tout dans l'IndexedDB
  du navigateur, les appels IA vont directement au fournisseur, aucun
  serveur nécessaire) ou mode serveur (backend FastAPI avec SQLite,
  multi-appareils).
- **Synchronisation en réseau local** entre appareils avec appairage
  par QR code et résolution de conflits.
- **Lanceur de bureau** pour Linux, macOS et Windows : un
  auto-hébergement en un clic basé sur Docker, avec détection de
  Docker contextuelle et autodiagnostic.
- **Onze langues d'interface**, entièrement traduites, avec un
  sélecteur de langue avec recherche.
- **Format de contenu ouvert** : les leçons sont du JSON pur, validé
  contre un schéma publié ; l'app consomme le moteur de contenu comme
  paquet.

Voir [Installation](../install/launcher.md).

## Accessibilité et UX

- **Thèmes vérifiés WCAG AA** (clair, sombre, préréglages colorés,
  mode auto qui suit le système), garantis par des vérifications de
  contraste automatisées.
- **Clavier d'abord** : raccourcis globaux avec overlay d'aide,
  Entrée fait avancer les leçons, Tab navigue entre les trous du
  texte à trous.
- **Prise en charge des lecteurs d'écran** : landmarks, étiquettes
  ARIA et régions live, tableaux de données pour les graphiques,
  gestion du focus des dialogues.
- La **réduction des animations** est respectée partout ; lecture à
  voix haute (TTS) pour les leçons et le chat.
- **Aide contextuelle dans l'app** : le panneau d'aide ouvre
  l'article de la vue actuelle ; chaque article renvoie vers ce site
  de documentation.
