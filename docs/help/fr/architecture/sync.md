# Architecture de synchronisation

Adaptive Learner est local-first : le mode serveur (API) conserve
les données dans le système de fichiers, le mode purement
navigateur (Dexie) dans IndexedDB. La **synchronisation** vise à
relier ces appareils via le réseau local. La référence complète se
trouve dans
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Trois rôles d'appareil

L'interface de synchronisation diffère selon le rôle de
l'appareil — et n'est affichée que là où elle est utilisable :

| Rôle | Mode de stockage | Interface de sync |
|---|---|---|
| Bureau (serveur) | API | générer un QR, statut, « Synchroniser maintenant » |
| Mobile (client) | Dexie | scanner un QR / coller un lien, statut après appairage |
| PWA seule | Dexie | aucune |

---

## SYNC-UI-GATE : n'afficher que ce qui fonctionne

Une fonction non disponible n'est **pas proposée** — pas de
boutons morts, pas d'espaces réservés grisés. Actuellement (la
phase d'appairage LAN n'est pas encore implémentée), la section
sync est donc visible **uniquement en mode API** ; sans flux
d'appairage fonctionnel, l'interface mobile-client tournerait à
vide.

Lorsque le mode LAN arrivera, le verrou binaire (API vs Dexie)
sera transformé en verrou à trois valeurs issu du tableau
ci-dessus. L'interface d'appairage ne sera **pas** réactivée au
préalable en mode Dexie, afin qu'aucun élément de commande mort
n'apparaisse sur le déploiement PWA seule.

---

## Pages connexes

- [Couche de stockage](../developer/storage-layer.md) — l'abstraction de stockage double
- [Sauvegarde et restauration](../features/backup.md) — transfert manuel des données sans sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
