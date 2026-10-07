# Vérification du contenu par l'IA

Adaptive Learner peut **faire vérifier, en option, par une IA** un
ensemble de leçons téléchargé (EXP-033). L'IA parcourt les cartes de
l'ensemble à la recherche de problèmes de traduction, de grammaire et
de niveau, et signale ce qu'elle trouve - elle ne bloque jamais rien,
elle se contente de conseiller. Par ailleurs, les dépôts portent un
**niveau de confiance** que tu peux lire d'un coup d'œil.

<!-- TODO: Screenshot - Navigateur de contenu, carte d'ensemble avec le bouton « Vérifier avec l'IA » + le badge « Vérifié par IA » -->

---

## Niveaux de confiance des dépôts

Chaque ensemble de leçons affiche, dans le Navigateur de contenu, un
badge de source avec un niveau de confiance. Il renseigne sur la
**provenance**, pas sur la qualité du contenu :

- **Confiance 0 - non validé.** Un dépôt nouvellement connecté dont
  la vérification automatique n'a pas (encore) réussi.
- **Confiance 1 - validé techniquement.** Le dépôt contient au moins
  une leçon et aucun code exécutable. La vérification est relancée à
  chaque synchronisation.
- **Confiance 3 - recommandé officiellement.** Un dépôt curaté issu
  de la liste de recommandations officielle.

Les évaluations de la communauté (Confiance 2) et un index central ne
sont pas encore implémentés.

---

## Prérequis pour la vérification par l'IA

La vérification par l'IA appelle un fournisseur d'IA directement
depuis le navigateur. Il te faut :

- une **clé API enregistrée** (Paramètres > IA) pour l'un des
  fournisseurs (Anthropic, OpenAI ou Gemini) ;
- le **mode navigateur** (Dexie) - la vérification s'exécute
  directement depuis le navigateur ;
- un **ensemble téléchargé** (la vérification porte sur les cartes
  mises en cache localement).

Sans clé, le bouton est visible mais désactivé ; un avis renvoie vers
les Paramètres.

> **Coût :** la vérification consomme des jetons sur ton propre compte
> chez le fournisseur et est facturée aux tarifs de ce fournisseur.
> Avant le démarrage, la boîte de dialogue affiche une **estimation du
> coût** que tu dois confirmer.

---

## Vérifier un ensemble - étape par étape

1. Ouvre le **Navigateur de contenu** et choisis un ensemble téléchargé.
2. Clique sur **« Vérifier avec l'IA »**.
3. La boîte de dialogue affiche une **estimation du coût**. Confirme-la
   pour lancer la vérification.
4. Les cartes sont vérifiées par **lots** ; une barre de progression
   suit l'avancement, et tu peux **annuler** à tout moment.
5. À la fin, tu obtiens un **rapport par carte** : seules les cartes
   avec une remarque sont listées, chacune avec la leçon à laquelle
   elle appartient et la note de l'IA.

Un court **délai d'attente** sépare deux vérifications (environ une
minute), pour que tu ne sois pas facturé deux fois par accident.

---

## Appliquer les suggestions (tes propres ensembles)

Tu vérifies tes propres ensembles sous **Contenu > Mon contenu** :
chaque ligne d'ensemble y porte le même bouton **Vérifier avec l'IA**.
Pour un ensemble que tu as créé toi-même, le rapport porte le bouton
**Appliquer les suggestions**. Il ouvre un tableau avec une ligne par
suggestion qui nomme un champ de carte (recto, verso, notes) : leçon,
carte, champ, valeur actuelle et valeur suggérée. Chaque ligne est
cochée ; décoche ce qui est une explication plutôt qu'une valeur. Les
remarques sans valeur applicable sont seulement comptées, jamais
écrites. Le bouton de confirmation indique le nombre de champs et de
cartes qu'il modifie.

L'écriture passe par le même chemin que l'éditeur : l'ensemble entier
avec toutes ses leçons, si bien que le titre, les langues, le niveau
et la description sont conservés, que les identifiants des cartes ne
changent pas et que ta progression d'apprentissage est préservée. Les
valeurs précédentes sont enregistrées et **Annuler la dernière
application** les restaure. Après une application, le rapport
enregistré est obsolète et il est supprimé ; revérifie l'ensemble
quand tu veux un résultat à jour. Pour les ensembles téléchargés, le
bouton est désactivé, avec une note indiquant qu'il ne s'applique qu'à
tes propres leçons.

## Rapport, cache et badge « Vérifié par IA »

- **Mis en cache.** Le rapport est stocké localement (IndexedDB) et
  réaffiché la fois suivante sans payer à nouveau. Il porte une
  empreinte du contenu + une signature, de sorte qu'un ensemble
  modifié suggère une nouvelle vérification.
- **Exportable.** Tu peux télécharger le rapport en **Markdown** -
  pratique pour le coller dans une révision de leçon ou dans un ticket.
- **Badge.** Un ensemble vérifié affiche un badge **« Vérifié par IA »**
  dans le Navigateur de contenu, pour que tu voies qu'une vérification
  existe.

L'IA est **consultative** : elle met en évidence des problèmes
possibles mais ne t'empêche jamais d'apprendre, de modifier ou de
partager un ensemble. La décision t'appartient.

---

Pour savoir comment cela fonctionne en coulisses, consulte la
documentation développeur sur
[l'intégration de l'IA](../developer/ai-integration.md).
