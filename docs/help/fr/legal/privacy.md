# Politique de confidentialité

> Cette page est une traduction automatique de l'original allemand, fournie à titre purement informatif. Seule la version allemande fait foi juridiquement.

Dernière mise à jour : 29 octobre 2026

En tant que texte juridique, cette politique utilise le vouvoiement.

La présente politique s'applique à la version web publique d'Adaptive Learner à
l'adresse `astrapi69.github.io/adaptive-learner`, à l'aperçu public de la
prochaine version à l'adresse
`astrapi69.github.io/adaptive-learner-content-test` et aux présentes pages de
documentation. Si vous installez vous-même Adaptive Learner (lanceur de bureau
ou Docker), vous exploitez vous-même l'application sur votre propre appareil et
l'exploitant de ces pages ne reçoit alors que ce que vous lui envoyez
vous-même, par exemple une leçon partagée ou un rapport d'erreur. Même dans ce
cas, l'application et le lanceur interrogent `api.github.com` sur les nouvelles
versions, les contenus d'apprentissage proviennent de GitHub, et votre propre
serveur envoie les requêtes d'IA au fournisseur choisi.

## Responsable du traitement

Asterios Raptis, Seestraße 68, 71638 Ludwigsburg, Allemagne

E-mail : asteri.raptis@gmail.com

## L'essentiel en bref

Adaptive Learner n'a aucun serveur de l'exploitant. L'application et les
présentes pages ne déposent aucun cookie, n'utilisent aucun service d'analyse
ou de suivi et ne chargent ni polices ni scripts depuis des tiers. Sont stockés
dans votre navigateur, entre autres, votre progression, vos statistiques et vos
paramètres. L'exploitant n'en reçoit que ce que vous lui envoyez vous-même, et
d'autres n'en reçoivent des parties que lorsqu'une fonction en a besoin, par
exemple votre fournisseur d'IA lorsque vous utilisez l'IA avec votre propre
clé, ou GitHub lorsque l'application demande d'elle-même s'il y a de nouveaux
contenus.

Des données ne quittent votre appareil que dans les cas suivants, décrits en
détail plus bas :

- Lorsque vous ouvrez l'application et les présentes pages, GitHub, en tant
  qu'hébergeur, traite, entre autres, votre adresse IP.
- L'application charge les contenus d'apprentissage depuis GitHub et y vérifie
  aussi d'elle-même s'il y a du nouveau.
- Lorsque vous partagez une leçon avec la communauté ou utilisez des fonctions
  GitHub avec votre propre jeton d'accès, les données vont à GitHub ;
  l'exploitant reçoit aussi les contributions partagées.
- GitHub ne reçoit un rapport d'erreur que lorsque vous l'ouvrez vous-même sur
  GitHub.
- Les fonctions d'IA envoient vos requêtes, avec votre propre clé, directement
  au fournisseur que vous avez choisi.
- Pour la saisie vocale et la lecture à voix haute, votre navigateur peut
  utiliser, selon son éditeur, un service en ligne.
- Les boutons de partage et les liens externes n'ouvrent d'autres sites
  qu'après votre clic.
- Vous écrivez un e-mail à l'exploitant.

## Hébergement sur GitHub Pages

L'application, l'aperçu et la présente documentation sont fournis par GitHub
Pages, un service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco,
CA 94107, USA. À chaque requête, GitHub traite l'adresse IP de votre appareil
et les données de connexion habituelles (heure, fichier demandé, type de
navigateur) ; selon ses propres indications, GitHub journalise et conserve
l'adresse IP à des fins de sécurité. L'exploitant ne reçoit pas ces données.

La base juridique est l'intérêt légitime à une fourniture sûre et performante
(article 6, paragraphe 1, point f), du règlement général sur la protection
des données, RGPD). GitHub est certifié au titre du
cadre de protection des données UE-États-Unis (EU-US Data Privacy Framework) ;
le transfert vers les États-Unis est donc couvert par une décision
d'adéquation (article 45 du RGPD). Plus d'informations :
[GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Au-delà, les présentes pages de documentation ne chargent rien depuis d'autres
serveurs : elles utilisent les polices de votre système, et la recherche
s'exécute dans votre navigateur, sans que vos termes de recherche le quittent.

## Chargement des contenus d'apprentissage

Les contenus d'apprentissage se trouvent dans des dépôts de contenu sur GitHub.
Votre navigateur les charge directement depuis `raw.githubusercontent.com`, et
les dépôts dotés de leur propre jeton d'accès via `api.github.com`. Le
destinataire, lui-même responsable du traitement, est GitHub, Inc. (voir
ci-dessus). L'application charge :

- lorsque vous ouvrez, téléchargez ou mettez à jour un ensemble, ses leçons et
  ses images,
- lorsque vous ouvrez la page Contenu, le catalogue : dépôts recommandés,
  index de recherche, listes de médias et de livres, et couvertures de livres,
- à la fin de chaque leçon, la liste des médias complémentaires,
- lorsque vous ajoutez ou vérifiez un dépôt, utilisez un code d'invitation ou
  ouvrez un lien partagé vers un ensemble, une invitation ou un dépôt, les
  fichiers nécessaires.

En outre, l'application vérifie d'elle-même, sans que vous cliquiez sur quoi
que ce soit, si vos ensembles ont de nouvelles versions et quelles révisions
sont dues. Pour cela, elle lit les fichiers manifestes du catalogue officiel et
de vos dépôts connectés, par exemple au démarrage, lorsque vous passez d'une
page à l'autre, lorsque la fenêtre revient au premier plan et après vos réponses
dans les révisions. Votre navigateur répond généralement aux requêtes répétées à
brefs intervalles depuis son cache. La vérification s'exécute sur toutes les
pages de l'application qui affichent la barre de navigation, donc aussi dès une
première visite via un lien partagé ou direct et sur la page d'erreur d'une
adresse mal saisie, y compris sous /docs/. En outre, l'application synchronise
les dépôts connectés au chargement de chaque page, même sans barre de
navigation, lorsque la dernière synchronisation date de plus d'un jour.

GitHub reçoit votre adresse IP, les données habituelles du navigateur (type et
version du navigateur, système d'exploitation, langue), en général l'origine
de la requête (`astrapi69.github.io`) et le chemin du fichier demandé. Ce
chemin montre quels dépôts, ensembles et leçons vous utilisez, y compris des
dépôts que vous avez ajoutés vous-même, et, lorsque vous l'utilisez, le code
d'invitation. Aucun cookie n'est déposé ni envoyé.

La base juridique est, pour les contenus que vous demandez, la fourniture de la
fonction (article 6, paragraphe 1, point b), du RGPD) et, pour la vérification
automatique, l'intérêt légitime à vous afficher des contenus à jour et les
révisions dues (article 6, paragraphe 1, point f), du RGPD). Pour le transfert
vers les États-Unis, voir ci-dessus.

## Fonctions GitHub avec votre propre jeton d'accès

Certaines fonctions utilisent l'API GitHub (`api.github.com`) avec un jeton
d'accès personnel (« Token GitHub ») que vous saisissez vous-même, dans les
Paramètres sous Intégrations ou pour un dépôt donné. Le jeton est stocké dans
votre navigateur et n'est envoyé qu'à GitHub. Avec lui, l'application agit en
votre nom :

- Elle vérifie le jeton et lit à cette occasion votre nom d'utilisateur
  GitHub.
- Elle lit les dépôts privés que vous avez connectés, y compris lors de la
  vérification automatique ci-dessus.
- Elle partage une leçon avec la communauté : sous forme de pull request vers
  le dépôt public `astrapi69/adaptive-learner-content` de l'exploitant, via une
  copie (fork) dans votre compte.
- Elle soumet votre propre dépôt de contenu pour la recherche, également sous
  forme de pull request vers `astrapi69/adaptive-learner-content`.
- Elle exporte un ensemble vers un nouveau dépôt de votre compte, privé par
  défaut.
- Pour les coachs, elle crée, liste et désactive des codes d'invitation dans le
  dossier `codes/` de leur propre dépôt.

Sans jeton, « Partager avec la communauté » ouvre à la place la page d'édition
de GitHub (`github.com`) ; si la leçon tient dans l'adresse de cette page, son
contenu y figure. « Préparer la soumission » (Paramètres > Données >
Enregistrez votre dépôt) interroge `api.github.com` sur le dernier état du
dépôt que vous indiquez, avec le jeton de ce dépôt si vous en avez enregistré
un.

GitHub reçoit le jeton, votre adresse IP, les données habituelles du
navigateur, les noms des dépôts et des fichiers, et tout ce que vous partagez
ou exportez : la leçon ou les fichiers de l'ensemble, le message de commit, le
titre et la description de la pull request avec les détails de la leçon,
l'entrée du registre et, si vous l'indiquez, votre nom en tant qu'auteur. Un
code d'invitation contient le code, le dépôt, la branche, le nombre maximal
d'utilisations, la date d'expiration, une note et, si vous en intégrez un, un
jeton de lecture ; toute personne pouvant lire le fichier du code peut lire ce
jeton.

Ce que vous envoyez à `astrapi69/adaptive-learner-content` devient une pull
request publique indiquant votre nom d'utilisateur GitHub et, le cas échéant,
votre nom d'auteur. L'exploitant la reçoit, l'examine et peut intégrer la
contribution aux contenus (article 6, paragraphe 1, points b) et f), du RGPD).
La pull request et l'historique des versions du dépôt sont conservés tant que
le dépôt existe. Pour les autres fonctions, la base juridique est votre demande
(article 6, paragraphe 1, point b), du RGPD). Le destinataire est GitHub, Inc.
(voir ci-dessus).

## Rapports d'erreur

Vous préparez un rapport d'erreur avec le bouton d'un message d'erreur ou d'une
vue qui n'a pas pu être chargée (« Signaler un problème ») ou avec « Créer un
rapport d'erreur » dans les Paramètres sous « Diagnostic et assistance ». Vous
voyez d'abord le rapport. Ce n'est que lorsque vous cliquez sur « Ouvrir sur
GitHub » que l'application ouvre, dans un nouvel onglet, un formulaire
prérempli pour un nouveau ticket (issue) dans le dépôt
`astrapi69/adaptive-learner` sur `github.com`. Le rapport figure dans l'adresse
de cette page ; GitHub le reçoit donc dès l'ouverture de l'onglet, avant que
vous y envoyiez quoi que ce soit. En cas d'erreur interne lors de la création
d'une leçon, « Signaler le problème » ouvre directement un tel formulaire, avec
ce seul message d'erreur.

Le rapport contient le message d'erreur avec des détails techniques (par
exemple code d'état, point de terminaison, heure ou trace de pile) et votre
propre description. L'application n'ajoute les informations d'environnement
(version de l'application, navigateur, système d'exploitation, page actuelle)
et l'historique des actions (voir Stockage sur votre appareil) que si vous
cochez la case correspondante ; les deux cases sont d'abord décochées.

Si vous envoyez le ticket sur GitHub, il est public et lié à votre compte
GitHub. L'exploitant le reçoit et l'utilise pour corriger l'erreur (article 6,
paragraphe 1, point f), du RGPD) ; il est conservé tant que le ticket existe.
Le destinataire est GitHub, Inc. (voir ci-dessus).

## Fonctions d'IA avec votre propre clé

Les fonctions assistées par l'IA n'existent que si vous saisissez votre propre
clé API d'un fournisseur dans les Paramètres sous IA. Votre navigateur envoie
alors les requêtes directement à ce fournisseur ; l'exploitant ne reçoit pas
ces données. Vous avez votre propre contrat avec le fournisseur, et ses
conditions et sa politique de confidentialité s'appliquent. Le destinataire est
le fournisseur dont vous utilisez la clé :

- Anthropic (`api.anthropic.com`) : pour les clients de l'EEE, Anthropic
  Ireland, Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4, D04
  TR29, Irlande. La clé figure dans l'en-tête de la requête.
- OpenAI (`api.openai.com`) : pour les clients de l'EEE, OpenAI Ireland
  Limited, 1st Floor, The Liffey Trust Centre, 117-126 Sheriff Street Upper,
  Dublin 1, D01 YC43, Irlande. La clé figure dans l'en-tête de la requête.
- Google (`generativelanguage.googleapis.com`, l'API Gemini) : pour une
  utilisation payante avec une adresse de facturation dans l'EEE, Google Cloud
  EMEA Limited, 70 Sir John Rogerson's Quay, Dublin 2, Irlande (avec une
  adresse de facturation en France, en Italie ou en Pologne, la société Google
  Cloud de ce pays) ; pour une utilisation gratuite, Google LLC, 1600
  Amphitheatre Parkway, Mountain View, CA 94043, USA. Ici, la clé figure dans
  l'adresse de la requête, et non dans son en-tête.

Des requêtes sont envoyées lorsque vous utilisez une fonction d'IA, par
exemple les sessions d'apprentissage (y compris l'évaluation automatique de
chaque étape), « Demander à l'IA » dans les leçons, la vérification de vos
réponses par l'IA, la génération d'exercices et de leçons, l'analyse de
conversations importées, les cartes de révision, les questions d'étude et le
guide d'étude, la pratique de la prononciation ainsi que la vérification et la
génération de contenus par l'IA. Sans que vous
tapiez quoi que ce soit, l'application envoie en outre :

- une demande de la liste des modèles disponibles lorsque vous ouvrez la page
  Session ou la sélection du modèle dans les Paramètres,
- une requête de test au fournisseur d'une clé lorsque vous enregistrez la clé,
  restaurez une sauvegarde de clé ou cliquez sur « Tester », même si ce
  fournisseur n'est pas actif à ce moment-là,
- une seule fois, les premières requêtes d'une session d'apprentissage que vous
  démarrez à partir d'une conversation importée ; elles contiennent la
  conversation collée.

Chaque requête transmet votre clé, votre adresse IP et les données habituelles
du navigateur, y compris l'origine de la requête (`astrapi69.github.io`). La
demande de liste des modèles et la requête de test sont une seule et même
demande et ne contiennent rien d'autre ; après une demande réussie,
l'application ne la renvoie pas pour la même clé dans le même onglet pendant
une heure. Les autres requêtes contiennent, selon la fonction :

- vos messages, questions et réponses et l'historique de la session,
- les contenus d'apprentissage concernés (leçons, exercices, cartes),
- le sujet et l'objectif de votre projet d'apprentissage et votre méthode
  d'apprentissage préférée avec sa pondération,
- les titres et résultats de vos leçons terminées, la leçon en cours et vos
  dernières erreurs avec votre réponse et la réponse attendue,
- pour les questions d'étude, l'historique d'au plus cinq de vos dernières
  sessions terminées avec leur heure de début et leur méthode,
- pour le guide d'étude, l'historique d'au plus dix de vos dernières sessions
  terminées avec leur heure de début et leur méthode et, en outre, la durée
  prévue, les minutes par jour, toutes les pondérations des méthodes et le
  vocabulaire des conversations analysées,
- pour les conversations importées, leur titre et le texte collé complet,
- dans la pratique de la prononciation, la phrase cible et le texte reconnu de
  votre essai,
- la langue dans laquelle l'IA doit répondre.

La base juridique est la fonction que vous utilisez (article 6, paragraphe 1,
point b), du RGPD) ; pour la demande de liste des modèles et la requête de
test, l'intérêt légitime à vous afficher les modèles disponibles et à signaler
immédiatement une clé non valide (article 6, paragraphe 1, point f), du RGPD).

Les fournisseurs peuvent aussi traiter les données hors de l'UE, notamment aux
États-Unis. Selon ses conditions contractuelles, Anthropic fonde les transferts
vers des pays tiers sur des clauses types de protection des données adoptées
par la Commission européenne (article 46, paragraphe 2, point c), du RGPD),
OpenAI sur de telles clauses ou sur une décision d'adéquation ; Google LLC est
certifiée au titre du cadre de protection des données UE-États-Unis
(article 45 du RGPD). Politiques de confidentialité des fournisseurs :

- [Anthropic](https://www.anthropic.com/legal/privacy)
- [OpenAI](https://openai.com/policies/eu-privacy-policy/)
- [Google](https://policies.google.com/privacy) et les
  [conditions d'utilisation de l'API Gemini](https://ai.google.dev/gemini-api/terms)

## Saisie vocale

Lorsque vous touchez le micro (dans le champ de saisie de la session
d'apprentissage et dans la pratique de la prononciation), l'application utilise
la reconnaissance vocale de votre navigateur. L'enregistrement ne commence
qu'après ce geste ; avant qu'il ne commence, votre navigateur demande
l'autorisation d'utiliser le micro, sauf si vous l'avez déjà accordée à ce
site. C'est le navigateur, et non l'application, qui effectue la
reconnaissance : Google Chrome envoie à cet effet, entre autres,
l'enregistrement et la langue choisie à un service de Google
(`www.google.com`) ; les autres navigateurs peuvent eux aussi envoyer
l'enregistrement à un service de leur éditeur. Le responsable du
traitement pour cette reconnaissance est l'éditeur du navigateur, et sa
politique de confidentialité s'applique. Pour Chrome, il s'agit de Google, pour
les utilisateurs de l'EEE, selon la
[politique de confidentialité de Google](https://policies.google.com/privacy),
de Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande ;
Google peut aussi traiter les données aux États-Unis, et Google LLC est
certifiée au titre du cadre de protection des données UE-États-Unis.

L'application ne reçoit que le texte reconnu. Dans la session d'apprentissage,
il arrive dans le champ de saisie, dans la pratique de la prononciation dans
votre essai ; lorsque vous l'envoyez, il va à votre fournisseur d'IA. La base
juridique pour lancer la reconnaissance est votre demande (article 6,
paragraphe 1, point b), du RGPD). Dans les Paramètres sous Apprentissage,
« Afficher le bouton micro » permet de masquer la saisie vocale. Les
enregistrements des exercices « Parler et enregistrer » sont en revanche
réalisés par l'application elle-même ; ils sont stockés dans votre navigateur.

## Lecture à voix haute

Vous lancez la lecture à voix haute avec les boutons de lecture, la touche R ou
« Tout lire » ; la lecture automatique ne fonctionne que si vous l'activez.
Sont lus les textes des leçons, les consignes, les questions de l'évaluation du
type d'apprentissage, les réponses de l'IA et les phrases de la pratique de la
prononciation. Pour cela, l'application utilise la synthèse vocale de votre
navigateur ou de votre système d'exploitation. Elle privilégie une voix qui
s'exécute sur votre appareil. Une voix en ligne ne lit que dans trois cas :
s'il n'existe pas de voix locale pour la langue, si vous avez vous-même choisi
une voix en ligne dans les Paramètres, et dans les premiers instants après le
chargement d'une page, parce que votre appareil n'a alors pas encore mis à
disposition ses propres voix.

Une voix en ligne envoie le texte à lire à son fournisseur. Dans Google Chrome,
ce sont des voix de Google ; le texte figure alors dans l'adresse de la requête
envoyée à `www.google.com`. Sous Linux, Chrome ne propose en général que de
telles voix. Le responsable du traitement est le fournisseur de la voix,
c'est-à-dire Google pour Chrome (voir Saisie vocale). La base juridique est
votre demande (article 6, paragraphe 1, point b), du RGPD).

## Boutons de partage

Un bouton de partage apparaît sur le Tableau de bord dans les lignes de
« Continuer l'apprentissage » dès que vous avez terminé une leçon avec un
résultat, et à la fin d'une leçon dans l'évaluation détaillée. Dans le
récapitulatif compact, il n'apparaît que s'il est activé dans les Paramètres
sous Apprentissage, dans « Résumé après les leçons » (il est désactivé par
défaut).
Si votre appareil propose sa propre boîte de dialogue de partage, l'application
l'ouvre, et vous y choisissez où partager. Sinon, elle affiche des liens vers
Facebook, LinkedIn, X et WhatsApp et une option de copie.

Ce n'est que lorsque vous cliquez sur l'un de ces liens que votre navigateur
ouvre la page du réseau ; le réseau reçoit alors votre adresse IP, les données
habituelles du navigateur et les cookies qu'il a lui-même déposés chez vous.
Facebook et LinkedIn ne reçoivent que l'adresse de l'application ; X et
WhatsApp, un texte prérempli avec le titre de la leçon, votre résultat
(pourcentage et nombre de bonnes réponses) et l'adresse de l'application ; vous
pouvez encore modifier ce texte avant de l'envoyer. L'application n'intègre
aucun script ni bouton de ces réseaux ; dès le clic, leurs politiques de
confidentialité s'appliquent. La base juridique est votre demande (article 6,
paragraphe 1, point b), du RGPD).

## Liens externes

L'application et les présentes pages contiennent des liens vers des services
externes (notamment GitHub, Amazon, YouTube, AnkiWeb, des plateformes de dons).
Les vidéos et les images des contenus d'apprentissage ou des réponses de l'IA
qui renvoient à d'autres serveurs sont, elles aussi, affichées par
l'application sous forme de lien ; ils ne sont chargés qu'après votre clic.
Avec ce clic, vous quittez l'application ou les présentes pages ; à partir de
là, la politique de confidentialité du fournisseur concerné s'applique. Aucun
script, bouton ou contenu intégré de ces fournisseurs n'est inclus.

## Stockage sur votre appareil

Ce que vous créez dans l'application est stocké localement par votre navigateur
dans IndexedDB et localStorage : profil, projets d'apprentissage, progression
et statistiques, notes, conversations importées, leçons téléchargées,
enregistrements vocaux des exercices « Parler et enregistrer », sauvegardes
automatiques et vos paramètres, y compris vos clés API et votre jeton GitHub,
ainsi que des catalogues mis en cache. L'application utilise en outre :

- le sessionStorage, que votre navigateur efface à la fermeture de l'onglet,
  pour l'historique des actions destiné aux rapports d'erreur (vos dernières
  actions dans l'application, par exemple les boutons cliqués, les changements
  de page, les options choisies, les notifications et les erreurs, mais aucune
  saisie au clavier) et, si vous avez saisi une clé d'IA, pour la liste des
  modèles de votre fournisseur, pendant une heure, enregistrée sous une courte
  empreinte de votre clé plutôt que sous la clé elle-même,
- le Cache Storage pour les fichiers de l'application et les leçons
  téléchargées, afin qu'elle fonctionne aussi hors ligne.

Les présentes pages de documentation n'enregistrent que le jeu de couleurs
(clair ou sombre) dans le localStorage. L'aperçu public se trouve sur le même
domaine (`astrapi69.github.io`) que l'application ; tous deux partagent donc le
stockage de votre navigateur.

Ce stockage est strictement nécessaire aux fonctions que vous utilisez et
relève de l'exception prévue au § 25, al. 2, n° 2 TDDDG (loi allemande sur la
protection des données dans les télécommunications et les services
numériques) ; aucun consentement n'est requis. Le stockage lui-même ne
transmet rien ; les sections ci-dessus décrivent quand des données quittent
votre appareil. Vous pouvez à tout moment exporter ou supprimer les données
dans les Paramètres, ou effacer les données du site dans votre navigateur.

## Contact par e-mail

Si vous écrivez un e-mail à l'exploitant, vos informations sont conservées
pour traiter la demande (article 6, paragraphe 1, points b) et f), du RGPD) et
supprimées dès que la demande est traitée et qu'aucune obligation légale de
conservation ne s'y oppose.

## Vos droits

Vous disposez à l'égard du responsable du traitement d'un droit d'accès
(article 15 du RGPD), de rectification (article 16), d'effacement
(article 17), de limitation du traitement (article 18), à la portabilité des
données (article 20) et d'opposition aux traitements fondés sur des intérêts
légitimes (article 21). Vous pouvez également introduire une réclamation
auprès d'une autorité de contrôle de la protection des données (article 77 du
RGPD), par exemple l'autorité de votre lieu de résidence habituelle ou celle
du siège du responsable du traitement.

Comme l'exploitant ne détient pas vos données d'apprentissage, les demandes
d'accès et d'effacement concernant ces données se traitent sur votre propre
appareil : Paramètres, Données, Exporter ou Supprimer. Pour les contributions,
les rapports d'erreur et les e-mails que l'exploitant a reçus de vous,
adressez-vous à l'adresse e-mail indiquée ci-dessus.

## Modifications

La présente politique est mise à jour lorsque l'application ou la situation
juridique change. La date de la version en vigueur figure en haut de page.

Voir aussi les [mentions légales](imprint.md).
