# Architecture des missions quotidiennes

Les missions quotidiennes (EXP-010, Phase 56) ajoutent une
motivation active et optionnelle par-dessus les récompenses
passives XP/badges/séries. Elles fonctionnent dans les deux
modes de stockage et n'ajoutent qu'une seule table de suivi.

## Composants

| Module | Rôle |
|---|---|
| `plugins/.../missions/templates.yaml` | Catalogue statique de missions (22 templates, 5 catégories), synchronisé vers le frontend par `make sync-missions`. |
| `MissionTemplate` (Pydantic) | Forme d'une entrée de catalogue (configuration, PAS une table). |
| `UserMission` (modèle) | La seule nouvelle table : assignation par utilisateur/par jour + progression + garde `xp_awarded`. Alembic `0021`, Dexie v20, surface de sync (MUTABLE). |
| `lib/missions/generator.ts` + `generator.py` | Sélection adaptative déterministe (PRNG avec seed) : un choix par tranche de difficulté, éligibilité selon l'historique (nouveau/actif/vétéran), pas de répétitions consécutives. |
| `lib/missions/checks.ts` + `SUPPORTED_CHECK_FUNCTIONS` | Seuls les contrôles calculables à partir des données existantes peuvent être assignés (les 5 autres entrées du catalogue restent non assignées jusqu'à ce que le suivi existe). |
| `lib/missions/progress.ts` | `check_function` pure + snapshot des stats → {current, target, completed}. |
| `lib/missions/schedule.ts` | `today` minuit local (langue → fuseau horaire) + joker de série. |
| `storage/missions-dexie.ts` | Dexie : collecte un snapshot de stats « aujourd'hui », assigne de manière idempotente, évalue, attribue les XP à la complétion. |
| `service.py` du plugin missions | Même flux contre SQLAlchemy pour le mode API (`GET /today`, `POST /regenerate`). |

## Flux

1. Le widget du tableau de bord (ou la complétion d'une leçon)
   appelle `getStorage().missions.getDaily(userId, {todayIso})`.
2. Si aucune ligne n'existe pour ce jour local, le générateur
   assigne un ensemble frais (seeded par `userId + date`, en
   excluant celles d'hier).
3. La progression est réévaluée par rapport aux données existantes
   (LessonProgress / ElementError / série). Une mission nouvellement
   complétée bascule `completed` et, une seule fois, attribue son
   `xp_reward` (idempotent via `xp_awarded`).
4. `celebrateMissions` (bus de célébration) joue le son de mission
   + affiche une phrase de félicitations ; un all-clear joue le son
   plus grand + un burst de confettis.

## Règles

- Déterministe par (userId, date) ; un utilisateur emploie un seul
  backend de stockage, donc la parité exacte cross-backend n'est
  pas requise.
- Pas de suivi au-delà de `UserMission` ; les contrôles non
  traçables ne sont pas assignés.
- Les missions sont supplémentaires - un échec ne doit jamais
  interrompre le flux de la leçon (toutes les lectures sont
  défensives). Aucune pénalité pour les jours manqués.
