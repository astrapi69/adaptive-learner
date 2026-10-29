# Changer le port (et conserver tes données)

Le lanceur de bureau te permet de changer le port sur lequel Adaptive
Learner s'exécute (par défaut **8501**). C'est pratique lorsqu'une
autre application utilise déjà ce port - mais il y a une conséquence à
connaître avant de le faire.

## Pourquoi le port compte pour tes données

Le stockage d'une application web est lié à son adresse web exacte,
port compris. `http://localhost:8501` et `http://localhost:8502` sont
deux adresses **différentes** pour ton navigateur, et chacune obtient
son propre stockage séparé.

Ce que cela signifie en pratique dépend de la façon dont tu utilises
Adaptive Learner :

- **Mode serveur** (le mode par défaut du lanceur de bureau). Tes
  ensembles, tes leçons et ta progression se trouvent dans le backend
  propre de l'application, pas dans le navigateur. Ils ne sont **pas**
  affectés par un changement de port - l'application les retrouve
  automatiquement à la nouvelle adresse.
- **Mode de stockage navigateur** (l'option que tu peux activer dans
  *Paramètres > Général > Mode de stockage*, et le mode qu'utilise la
  version web publique). Tes ensembles, ta progression et les
  exercices que tu as rédigés toi-même se trouvent **dans le
  navigateur**, liés à l'adresse actuelle. Après un changement de port, l'application s'ouvre à la
  nouvelle adresse avec un stockage navigateur vide, si bien qu'on
  dirait un nouveau départ. **Tes données ne sont pas supprimées** -
  elles sont toujours stockées sous le port précédent, simplement
  invisibles sur le nouveau.

## Transférer tes données vers le nouveau port

Si tu utilises le mode de stockage navigateur et que tu as déjà changé
le port, tes données t'attendent sous l'ancienne adresse. Ramène-les
avec une sauvegarde :

1. Reviens **au port précédent** (par exemple
   `http://localhost:8501`). Tes données réapparaissent.
2. Ouvre **Paramètres > Données > Créer une sauvegarde** et
   enregistre le fichier `.alb`.
3. Passe au **nouveau port**.
4. Sur l'écran d'accueil, choisis **Restaurer depuis une sauvegarde existante**
   et sélectionne le fichier `.alb`. Tout - ensembles, progression,
   exercices et tes paramètres - est restauré.

Voir [Sauvegarde et restauration](../features/backup.md) pour en savoir
plus sur les sauvegardes.

## Éviter la surprise : sauvegarder d'abord

L'habitude la plus sûre est d'**exporter une sauvegarde avant de
changer le port**, afin de pouvoir la restaurer à la nouvelle adresse
s'il manque quelque chose. Une sauvegarde régulière est de manière
générale une bonne assurance - elle te permet aussi de déplacer ton
apprentissage d'un appareil à l'autre.

## Changer le port n'ouvre pas l'application au réseau

Quel que soit le port choisi, l'application continue d'écouter
uniquement sur `127.0.0.1` - accessible depuis cet ordinateur, pas
depuis d'autres appareils. Elle n'a pas d'écran de connexion, donc y
accéder depuis ton téléphone ou une autre machine est une étape
séparée et délibérée (`ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0`), qui
n'a de sens que dans un réseau de confiance - voir
[Démarrer le lanceur de bureau](launcher.md) (« Qui peut accéder à
l'application »).
