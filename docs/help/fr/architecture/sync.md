# Architecture de synchronisation

Adaptive Learner est local-first. En mode de stockage Serveur (API
en interne), le backend de l'application de bureau enregistre les
données d'apprentissage ; il ne reste alors que peu de choses dans
le navigateur, par exemple certains réglages et, jusqu'à leur
transfert, des modifications enregistrées hors ligne (voir
[Paramètres](../user-guide/settings.md)). En mode de stockage Local
(Navigateur), appelé Dexie en interne, elles se trouvent dans
l'IndexedDB du navigateur dans lequel l'application s'exécute. La
**synchronisation** doit à l'avenir relier des appareils via le
réseau local ; elle n'est pas encore utilisable (voir la section
SYNC-UI-GATE ci-dessous). La référence complète se trouve dans
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Trois rôles d'appareil

L'interface de synchronisation est prévue différemment selon le rôle
de l'appareil :

| Rôle | Mode de stockage | Interface de sync |
|---|---|---|
| Bureau (serveur) | API | générer un QR, statut, « Synchroniser maintenant » |
| Mobile (client) | Dexie | scanner un QR / coller un lien, statut après appairage |
| PWA seule | Dexie | aucune |

---

## SYNC-UI-GATE : principe et état actuel

Le principe est le suivant : n'afficher que ce qui fonctionne. Le
mode LAN (phase 1) n'est encore que partiellement mis en œuvre et
n'est pas encore utilisable. Parmi les vues d'appairage, seule celle
qui génère un lien d'appairage est accessible pour l'instant, et
elle aussi uniquement en mode de stockage Serveur de l'application
de bureau ; la vue qui utilise le lien sur un autre appareil (coller
le lien, scanner le QR code) est volontairement désactivée. Le
verrou dépend du mode de stockage :

- En mode de stockage **Serveur** (API en interne), qui n'existe que
  dans l'application de bureau, la zone *Paramètres > Données >
  Synchronisation* ne propose que la génération d'un lien
  d'appairage : elle affiche des champs de saisie pour l'hôte et le
  port et le bouton « Générer un code d’association » ; après un
  clic sur ce bouton apparaissent un QR code, le lien d'appairage et
  un bouton de copie.
- En mode de stockage **Local (Navigateur)**, appelé Dexie en
  interne, la zone reste visible, mais affiche, au lieu de commandes,
  l'avis « Disponible uniquement avec l'application de bureau. » La
  version navigateur utilise toujours ce mode de stockage, y compris
  comme application web installée (PWA) ; dans l'application de
  bureau, on peut également le choisir. Depuis #335/#336, les
  fonctions qui ne fonctionnent qu'avec le backend de l'application
  de bureau sont désactivées avec un avis au lieu d'être masquées ;
  c'est le mode de stockage, et non le type d'application, qui décide
  alors si la synchronisation est désactivée.
- La vue qui utilise le lien n'apparaîtrait qu'en mode de stockage
  Local (Navigateur), où la zone est désactivée ; elle n'apparaît
  donc jamais.

Comme aucun appareil ne peut être appairé, la vue d'un appareil
appairé n'apparaît pas non plus, ni donc son bouton
« Synchroniser maintenant » ; la synchronisation n'échange aucune
donnée.

Aujourd'hui, la zone s'écarte du principe, entre autres de ces
façons :

- Sa description
  « Associer des appareils et garder les données à jour. » promet
  une association d'appareils et une mise à jour des données, qui
  n'existent encore ni l'une ni l'autre.
- En mode de stockage Serveur, l'application de bureau propose de
  générer un lien d'appairage qu'aucun appareil ne peut encore
  utiliser.
- L'avis « Disponible uniquement avec l'application de bureau. »
  renvoie à l'application de bureau, avec laquelle on ne peut pas non
  plus encore synchroniser ; dans l'application de bureau elle-même,
  il apparaît en mode de stockage Local (Navigateur).

Une fois le mode LAN mis en œuvre, le verrou binaire (API vs Dexie)
doit devenir le verrou à trois valeurs du tableau ci-dessus. La vue
qui utilise le lien ne doit être réactivée qu'avec ce verrou. Si on
l'activait tant que le verrou binaire s'applique encore, elle
apparaîtrait sur chaque appareil en mode de stockage
Local (Navigateur), car ce verrou ne distingue pas les rôles
« Mobile (client) » et « PWA seule ». Elle y serait un élément de
commande mort : tant que le mode LAN n'est pas mis en œuvre, sur
chacun de ces appareils, et même après sa mise en œuvre, encore sur
les appareils ayant le rôle « PWA seule », tant que le verrou
binaire s'applique.

---

## Pages connexes

- [Couche de stockage](../developer/storage-layer.md) - l'abstraction de stockage double
- [Sauvegarde et restauration](../features/backup.md) - transfert manuel des données sans sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
