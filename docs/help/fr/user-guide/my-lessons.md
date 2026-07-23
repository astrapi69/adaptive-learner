# Mes leçons

La section **Mes leçons** à `/content` affiche les leçons que vous avez
créées vous-même — soit générées à partir d'une analyse de chat, soit
importées manuellement.

---

## Créer une leçon à partir d'une analyse de conversation

Après avoir importé et analysé un historique de chat :

1. Allez sur la page de détail de l'import (`/import/:id`)
2. Cliquez sur **Enregistrer comme leçon hors ligne**
3. Le système génère automatiquement une leçon complète à partir de l'analyse :
   - Théorie à partir du sujet / résumé / sous-thèmes / forces / faiblesses
   - Matching, texte libre, cloze et assemblage de mots à partir du vocabulaire
4. Vérifiez et enregistrez

Le générateur est **déterministe et hors ligne** — aucun appel IA n'est requis.
La qualité s'adapte à la richesse du vocabulaire dans l'analyse.

---

## Enregistrer une leçon adaptative

Sur la page de résumé d'une session de leçon adaptative (`/adaptive-lesson/:setId`),
un bouton **Enregistrer cette leçon ?** permet de transformer la session en
un ensemble de contenu réutilisable auto-contenu.

---

## Lire, modifier, supprimer, exporter, partager

Dans la section **Mes leçons**, chaque leçon possède des actions :

| Action | Description |
|--------|-------------|
| Lire | Lance la leçon dans le lecteur standard |
| Modifier | Ouvre un éditeur JSON pour modifier la structure |
| Supprimer | Supprime la leçon localement |
| Exporter | Exporte en fichier `.json` ou `.zip` |
| Partager | Ouvre l'assistant de partage communautaire |

---

## Importer une leçon

Cliquez sur **Importer une leçon** dans la section Mes leçons :

1. Sélectionnez un fichier `.json` ou `.zip`
2. Le système valide le schéma avant d'enregistrer
3. La leçon apparaît dans Mes leçons et peut être lue immédiatement

---

## Partager avec la communauté

L'assistant de partage vous guide à travers :

1. **Validation de contenu** — un validateur côté client vérifie que la leçon
   respecte les normes de qualité (≥ 5 exercices, ≥ 2 types, etc.)
2. **Révision IA optionnelle** — validation de la traduction / grammaire /
   niveau CECR avec suggestions de correction automatique
3. **Aperçu de placement** — où la leçon s'inscrirait dans l'arborescence
   des contenus de la communauté
4. **Soumission** — ouvre l'éditeur de PR web de GitHub avec un formulaire
   pré-rempli

La contribution va vers le dépôt de contenu officiel :
[astrapi69/adaptive-learner-content](https://github.com/astrapi69/adaptive-learner-content)

---

## Format de leçon

Les leçons utilisateur suivent le même schéma JSON que les leçons
téléchargées. Elles sont jouées dans le lecteur de leçon non modifié — aucune
distinction dans la lecture.

Voir le [guide de création de contenu](../developer/authoring-content.md) pour
le format complet.
