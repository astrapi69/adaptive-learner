# Couche de stockage

## L'interface `IStorageService`

Tous les composants React accèdent aux données via `getStorage()`, qui
retourne une implémentation de `IStorageService`, définie dans
`frontend/src/storage/types/core/service.ts` ; la liste de ses espaces de noms y
fait foi (par exemple `users`, `projects`, `session`, `curricula`,
`lessons`, `gamification`, `anki`, `contentLoader`, `backup`,
`missions`).

---

## ApiStorage

`ApiStorage` traduit chaque méthode de `IStorageService` en un appel
HTTP `fetch()` vers le backend FastAPI correspondant.

Résolution des clés API : la clé du fournisseur actif est lue depuis
la réponse API - jamais stockée dans le frontend.

---

## DexieStorage

`DexieStorage` implémente la même interface directement via Dexie 4
(IndexedDB). Aucune requête réseau n'est effectuée pour les données.

**Schéma :** `storage/dexie/db.ts`, avec une nouvelle version
Dexie à chaque changement de schéma. Les magasins par domaine, et
la table du serveur que chacun représente :
[Modèle de données](data-model.md).

Les appels IA en mode Dexie utilisent `fetch()` directement depuis
le navigateur vers l'API du fournisseur.

**Clés API en mode Dexie :** stockées en clair dans `localStorage`
sous `adaptive-learner.{provider}_api_key`. Documenté et attendu
pour un déploiement GitHub Pages uniquement navigateur.

---

## Ajouter un troisième backend

Pour implémenter un troisième backend de stockage (par ex. une base
de données distante) :

1. Créez une classe qui implémente `IStorageService`
2. Implémentez les 22 espaces de noms
3. Enregistrez-la dans la résolution de `getStorage()`
4. Ajoutez une option dans les Paramètres pour la sélectionner

Les types TypeScript stricts (`IStorageService`, les sous-interfaces par
espace de noms) guident l'implémentation.

---

## Résolution du mode

`getStorage()` lit `localStorage.getItem('adaptive-learner.storage-mode')`.
Si la valeur est `'dexie'`, il retourne `DexieStorage`. Sinon, il retourne
`ApiStorage`.

Le changement de mode nécessite un rechargement de page (effectué automatiquement
depuis les Paramètres).

La variable d'environnement de build `VITE_STORAGE_MODE=dexie` définit
le mode par défaut pour le build GitHub Pages - les utilisateurs ne peuvent
pas revenir au mode API sans backend.
