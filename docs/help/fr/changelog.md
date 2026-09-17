# Quoi de neuf (v1.61 – v2.15)

Un aperçu orienté utilisateur des versions depuis la v1.61.0. Les
notes techniques complètes par version se trouvent sous
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v2.15.0 - Exercices plus riches, résumé de leçon compact

- **Exercices paramétriques :** une leçon peut déclarer des variables
  dont les valeurs sont tirées à nouveau à chaque tentative ; les
  réponses numériques sont évaluées avec une tolérance.
- **Trois nouveaux types d'exercices :** Repérage, Parsons et Mise en
  ordre, tous créables dans l'éditeur de leçons.
- **Explications après une réponse** ; quand tu crées une leçon à
  partir d'un texte, l'IA peut les rédiger pour toi.
- **Résumé de leçon compact** (résultat et XP), sauf si tu as
  personnalisé les sections du résumé ; **Évaluation détaillée** ouvre
  le bilan complet.
- **Paramètres réorganisés :** sections étiquetées avec une barre de
  sections dans les onglets Apprentissage et Données ; l'application de
  bureau liste ses extensions installées.
- **Rafraîchir** dans Mon contenu applique d'un coup toutes les mises à
  jour de set disponibles, sauf celles qui toucheraient ta progression ;
  le hub de contenu a son propre onglet Créer.
- Mentions légales et politique de confidentialité en allemand et en
  anglais ; correctifs sur téléphone pour le clavier iOS, les en-têtes
  surchargés et les barres d'onglets des hubs.

## v2.14.0 - Mode jeu et arcade

- **Mode jeu facultatif :** séries de combos, points qui s'envolent,
  points de contrôle, physique des réponses, cœurs et compte à rebours,
  avec son propre jeu de sons.
- **Mini-jeux d'arcade** débloqués avec des XP (Memory d'apprentissage,
  Snake, Morpion, Simon), plus des manches éclair à la fin d'un set.
- Variantes de couleur pour la mascotte ; préréglages d'avatar et
  cadres liés au niveau et aux badges débloqués.
- **Les pages de set** listent leurs leçons avec leur progression,
  quitter une leçon ramène à son set, et un bilan de fin de set
  rassemble toutes les erreurs du set.
- Les paramètres gagnent un onglet **Diagnostic et assistance**.
- Trois nouveaux types d'extension dans l'assistant de création :
  parler et enregistrer, choix audio, tuiles audio.

## v2.13.0 - Convertir les types d'exercices

- **Change le type d'un exercice sur place** dans l'éditeur de leçons ;
  l'historique de révision est conservé tant que le contenu subsiste,
  et l'IA remplit les champs qu'une conversion laisse vides.
- **Modifier en tant que copie** directement sur un set téléchargé ; ta
  copie est marquée comme ta propre modification, et réimporter un set
  conserve l'historique de révision des exercices inchangés.
- Le tour de correction en fin de leçon enregistre de nouveau tes
  réponses, et la lecture à voix haute garde l'écran allumé.

## v2.12.0 - Recommencer un set

- Recommence un set terminé sous forme de **nouveau passage**, pendant
  que ton historique de répétition espacée continue.
- Importe des clés de fournisseur depuis un export Topos `.alk` ;
  **Perplexity** rejoint les fournisseurs d'IA.

## v2.11.0 - Progression stable

- La progression d'apprentissage est ancrée à des **identités
  d'exercice stables**. Une migration locale unique au premier
  démarrage réattribue la progression existante, si bien que les
  corrections de contenu ne rendent plus tes cartes de révision
  orphelines.
- Exercices d'association repensés : l'aide se trouve dans la rangée
  de boutons, le compteur de progression en haut.

## v2.10.0 - Sécurité : uniquement en local par défaut

- **Mise à jour recommandée.** Le lanceur de bureau et le fichier
  compose lient désormais l'application à `127.0.0.1`. Auparavant,
  n'importe qui sur le même réseau pouvait l'ouvrir sans
  authentification, y compris les clés d'IA enregistrées.
- Pour accéder volontairement à l'application depuis un autre appareil,
  définis `ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` dans `.env`, et
  uniquement dans un réseau de confiance.

## v2.9.0 - Le lanceur se ferme de nouveau

- Le lanceur téléchargé se ferme quand tu fermes sa fenêtre, y compris
  sur les bureaux sans zone de notification (par exemple Ubuntu GNOME).
  L'application continue de tourner dans Docker.
- L'ordre des leçons que tu définis pilote désormais la séquence
  d'apprentissage, et la modification se fait au niveau de chaque
  leçon.

## v2.7.0–v2.8.2 - Le lanceur utilise une image publiée

- Le lanceur de bureau **télécharge une image publiée et vérifiée** au
  lieu de la construire sur ta machine (la v2.7.0 a été taguée, mais
  ses changements n'ont atteint les utilisateurs qu'avec la v2.8.0).
- Un avis de récupération aide les utilisateurs dont la progression de
  révision pour les leçons A1 corrigées de japonais, de coréen et de
  chinois était devenue orpheline ; il propose d'abord une sauvegarde et
  ne s'exécute jamais automatiquement.
- **Correctif de sécurité v2.8.1/v2.8.2 (mise à jour recommandée) :**
  l'image v2.8.0 affichait une page blanche en mode image, et le
  conteneur seul ne démarre plus en mode débogage.

## v2.6.0–v2.6.1 - Nouveau chat de session, leçons tirées de livres

- Le **chat de session** est reconstruit sur assistant-ui.
- **Créer des leçons à partir d'un livre :** téléverse un fichier EPUB,
  TXT, MD ou DOCX, choisis les chapitres et génère une leçon par section
  sélectionnée.
- L'éditeur de dictée accepte le téléversement de fichiers audio ; les
  sets de contenu peuvent être masqués via leur manifeste.
- Lanceur : détection de Docker selon le contexte et interface du
  lanceur traduite.

## v2.5.0 - Création complète d'exercices

- Chaque type d'exercice de base est **modifiable dans l'éditeur de
  leçons**, les exercices peuvent être ajoutés à la main, et le choix
  multiple se crée en mode réponse unique ou réponses multiples.
- Un **assistant de création d'extensions** couvre la catégorisation, la
  correction d'erreurs, la compréhension écrite et le quiz noté ; la
  **dictée audio** rejoint les types d'extension.

## v2.4.0 - Création de leçons améliorée

- Construis une leçon de connaissances à partir d'un **texte de manuel
  collé**, modifie une de tes leçons existantes, regroupe tes leçons en
  un set et téléverse des images de cartes.
- Les exercices à texte libre acceptent **plusieurs réponses** et
  proposent un **second avis de l'IA** sur une réponse fausse.
- L'onglet IA des paramètres mène directement à l'import de clés.

## v2.3.0 - Lecteur de leçons remanié

- Panneau d'options repliable, commande de pause dans le pied de page
  et zone de titre plus fine.
- **Exercices audio où l'on écoute d'abord**.
- Import et export plus robustes des fichiers de leçons et de sets.

## v2.2.0 - Exercices d'extension

- Quatre **types d'exercices d'extension créés par l'IA**, plus le choix
  multiple natif.
- Un **registre fédéré de dépôts de contenu** avec un parcours pour
  enregistrer un dépôt.
- Navigation mobile simplifiée, sans barre d'onglets en bas.

## v2.1.0 - Finitions après le lancement

- Retirer un dépôt de contenu **ne laisse plus de progression fantôme**
  sur le tableau de bord, dans la file de révision ou dans les leçons en
  pause.
- Paramètres réorganisés, correctifs du parcours d'apprentissage, un
  bouton **Demander à l'IA** facile à trouver et une synchronisation du
  contenu plus robuste.

## v2.0.0 - Lancement public

- La première version pour le grand public : gratuite et open source
  (MIT), conçue d'abord pour le hors-ligne, sans compte, avec répétition
  espacée, ta propre clé d'IA, la création et le partage de tes propres
  leçons, et une installation comme PWA.
- Un jalon de lancement, pas une rupture technique : aucun changement
  incompatible par rapport à la v1.99.0.

## v1.99.0 - Renforcement mobile

- **Choix multiple sous forme de boutons de réponse à toucher**, ce qui
  corrige les touches mal interprétées sur iPhone.
- Correctifs propres aux appareils : zoom au focus sur iOS, menu de
  suppression sur iPhone et langue de l'interface mémorisée.
- Filtre de langue du contenu dans Découvrir, sélection multiple dans
  Mon contenu, passage automatique facultatif et exemples résolus
  intégrés.

## v1.97.0–v1.98.0 - Hub de contenu repensé

- **Mon contenu** n'affiche que le contenu téléchargé ; l'import et la
  création ont rejoint l'onglet Importer ; vue en liste ou en grille et
  une barre de recherche et de filtres compacte.
- Barre latérale repliable sur ordinateur et statut par set (actif,
  reporté, terminé) avec suppression.
- Navigation verticale sur ordinateur et liens directs vers un set ;
  texte à trous « Sélectionne toutes les réponses correctes » ; les
  réponses d'examen allongent les intervalles de révision ; export
  `.alk` des clés d'IA chiffré par phrase secrète.
- Traductions espagnole et française relues.

## v1.95.0–v1.96.0 - Modes de leçon

- Joue une leçon ou un set en mode **Entraînement, Examen, Chronométré
  ou Aléatoire**, plus « Entraîner les erreurs » ; le mode examen avec
  retour différé, une vue des résultats, réussite ou échec et un bonus
  d'XP.
- Modes **Inversé et Infini**, codes d'invitation pour partager du
  contenu et transfert des données de la version en ligne vers une
  installation locale.
- Exporter un set vers un dépôt GitHub.

## v1.92.0–v1.94.1 - Renforcement hors ligne et du lanceur

- La PWA installée fonctionne en **mode stockage navigateur** comme
  prévu, avec des correctifs pour le guide d'étude, la prononciation et
  l'identité.
- **Lanceur de bureau :** parcours centré sur Docker avec progression
  visible, ports configurables et une seule fenêtre persistante ; le
  lanceur Windows se construit de nouveau.
- Les boîtes de dialogue de vérification du contenu par IA défilent sur
  ordinateur et indiquent quel fournisseur et quel modèle ont effectué
  la vérification.

## v1.91.0 - Restructuration de la navigation

- **Navigation principale réduite de plus de 12 entrées à 7 entrées
  groupées** (Tableau de bord, Parcours d'apprentissage, Mon contenu,
  Découvrir, Progrès, Paramètres, Aide) sans perte de fonction - chaque
  page reste accessible.
- **Barre d'onglets en bas sur mobile** (Apprendre / Contenu /
  Découvrir / Progrès / Plus) avec un panneau inférieur « Plus ».
- **ProgressHub** (`/progress`) regroupe Aperçu / Statistiques / Mes
  parcours en onglets ; **DiscoverHub** (`/discover`) gagne un onglet
  Importer. Les anciens liens continuent de fonctionner grâce à des
  redirections.
- La bannière de mise à jour de la PWA ne réapparaît plus une fois que
  tu as accepté une mise à jour.

## v1.90.0 - Génération d'exercices par IA + mise à jour automatique

- **Pipeline de génération d'exercices par IA :** générer des exercices
  pour une leçon uniquement théorique, avec contrôle qualité,
  équilibrage des types, régénération avec retour et génération par lot
  pour tout un set.
- **Résolution animée des paires** dans l'exercice d'association.
- **Bouton Tester par fournisseur** dans l'aperçu des fournisseurs
  configurés ([Paramètres](user-guide/settings.md)).
- **Vérification automatique des mises à jour sur ordinateur** via
  l'API GitHub Releases.
- Les réponses de l'IA en session arrivent désormais dans la langue de
  ton interface.

## v1.87.0–v1.88.0 - Découverte de contenu + partage par QR

- **Découverte de contenu (`/discover`) :** un index de recherche sur la
  bibliothèque ; le téléchargement par set a été déplacé ici, séparé de
  ton « Mon contenu » local.
- **Partage de l'application par code QR :** partage l'application via
  un code QR à scanner (copier / télécharger en PNG / partage natif).
- **Constructeur de programme** + rappels d'apprentissage quotidiens.
- **Interfaces en coréen et en indonésien** rejoignent les langues
  disponibles (11 désormais).

## v1.86.0–v1.87.0 - Validation du contenu par IA + sauvegarde `.alb`

- **Validation du contenu par IA :** contrôles qualité sur tout un set
  avec une interface de rapport, rapport mis en cache + export Markdown,
  et un badge « Vérifié par IA ».
- **Intégration de médias :** une section de leçon « Approfondir le
  sujet ».
- **Format de sauvegarde ZIP `.alb`**, qui remplace le simple export
  JSON et inclut désormais aussi un instantané du localStorage
  ([Sauvegarde et restauration](features/backup.md)).

## v1.70.0–v1.84.0 - UX, thèmes et TipTap 3

- **Restauration au premier lancement :** une installation vide propose
  « Restaurer depuis une sauvegarde existante » pendant l'intégration.
- **Refonte de la documentation** + aide contextuelle dans
  l'application.
- **Éditeur TipTap migré v2 → v3** (toute la pile `@tiptap/*`).
- **Activation par stratégie de fonctionnalités :** les fonctionnalités
  IA basculent entre actif / désactivé / masqué sans rechargement.
- Nombreux renforcements du contraste en thème sombre et de la mise en
  page mobile.

## v1.69.0 - Liens d'exemple + recommandations de livres

- **Liens d'exemple dans la théorie :** une étape de théorie peut
  porter un lien optionnel « Voir l'exemple ».
- **Recommandations de livres par domaine** dans le navigateur de
  contenu
  ([Recommandations de livres](content-creation/books.md)).
- **Raccourci Entrée aussi dans la reprise des erreurs**
  (« Répéter les erreurs »).
- **Correctif de sauvegarde :** le titre de l'ensemble est
  correctement lu depuis le manifeste lors de la restauration.

## v1.68.0 - Export des résultats + liens retour vers la théorie

- **Exporter le résultat de la leçon :** « Copier le résultat » /
  « Enregistrer comme fichier » (rapport Markdown pour les
  assistants IA).
- **Liens retour vers la théorie :** sauter d'un exercice à la
  théorie correspondante et revenir.
- **Exercice d'association remanié :** paires colorées + badges
  numérotés (sûr pour le daltonisme).
- **Contraste en mode sombre** corrigé à plusieurs endroits.

## v1.67.1 - Restauration de sauvegarde + stabilité du déploiement

- Correctif systématique de la **restauration de sauvegarde**.
- Rechargement automatique en cas de fragment de déploiement
  obsolète.
- Peaufinage du filtre par sujet (masqué à ≤ 1 sujet, le plus
  utilisé en premier).

## v1.65.0 - Évaluation reprenable + raccourci Entrée

- **Évaluation reprenable :** interrompre le test et le reprendre
  plus tard là où tu t'es arrêté.
- **Raccourci Entrée :** Entrée vérifie un exercice répondu et
  passe à la suite (commutable dans Paramètres → Apprentissage).
- Exercices d'association plus clairs + passage sur les jetons de
  design.

## v1.64.0 - Refonte de l'intégration

- **Démarrage rapide avec seulement le nom + le sujet** ; le reste
  prend des valeurs par défaut.
- **Assistant d'intégration** optionnel (une question par écran).
- L'**évaluation est désormais optionnelle**
  ([Intégration](user-guide/onboarding.md)).

## v1.63.0 - Préréglages de thèmes WCAG AA

- **6 thèmes recommandés** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), conformes AA par le calcul
  ([Système de thèmes](developer/themes.md)).
- Audit i18n systématique ; filtre du tableau de bord lié à
  l'utilisateur.

## v1.62.0 - Intégrité des sauvegardes + provenance du build

- Renforcement de la **restauration de sauvegarde** (coercition
  des types de données, ordre des FK).
- À propos affiche de vraies infos de build au lieu de « unknown ».

## v1.61.0 - Conformité des boutons + reprise de leçon

- Conformité des boutons shadcn à l'échelle de l'application.
- **Leçon en pause** reprise à l'étape exacte.
- Validation de contenu inter-dépôts.

---

## Grands axes de la période

- **Plusieurs dépôts de contenu (EXP-023) :** connecter ses
  propres dépôts, en gérer plusieurs, partager par lien/QR,
  niveaux de confiance, dépôts recommandés, évaluations locales
  ([Plusieurs dépôts de contenu](features/content-repos.md)).
- **Sauvegarde comme instantané complet** avec import
  inter-identités
  ([Sauvegarde et restauration](features/backup.md)).

---

## Pages connexes

- [Premiers pas](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) - notes complètes
