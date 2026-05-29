# Architektur der täglichen Missionen

Tägliche Missionen (EXP-010, Phase 56) ergänzen die passiven XP-/
Abzeichen-/Serien-Belohnungen um aktive, optionale Motivation. Sie
laufen in beiden Speicher-Modi und fügen genau eine Tracking-
Tabelle hinzu.

## Bausteine

| Modul | Aufgabe |
|---|---|
| `plugins/.../missions/templates.yaml` | Statischer Missionskatalog (22 Vorlagen, 5 Kategorien), via `make sync-missions` ins Frontend gebündelt. |
| `MissionTemplate` (Pydantic) | Form eines Katalogeintrags (Konfiguration, KEINE Tabelle). |
| `UserMission` (Model) | Die eine neue Tabelle: Zuweisung + Fortschritt pro Nutzer/Tag + `xp_awarded`-Schutz. Alembic `0021`, Dexie v20, Sync-Fläche (MUTABLE). |
| `lib/missions/generator.ts` + `generator.py` | Deterministische (geseedete PRNG) adaptive Auswahl: eine Wahl je Schwierigkeitsslot, Eignung nach Historie (neu/aktiv/Veteran), keine Wiederholung an Folgetagen. |
| `lib/missions/checks.ts` + `SUPPORTED_CHECK_FUNCTIONS` | Nur aus bestehenden Daten berechenbare Checks sind zuweisbar (die übrigen 5 Katalogeinträge bleiben unzugewiesen, bis Tracking existiert). |
| `lib/missions/progress.ts` | Reine Abbildung `check_function` + Stats-Snapshot -> {current, target, completed}. |
| `lib/missions/schedule.ts` | `today` bei lokaler Mitternacht (Sprache->Zeitzone) + Streak-Joker. |
| `storage/missions-dexie.ts` | Dexie: "Heute"-Stats sammeln, idempotent zuweisen, auswerten, XP bei Abschluss vergeben. |
| Missions-Plugin `service.py` | Gleicher Ablauf gegen SQLAlchemy für den API-Modus (`GET /today`, `POST /regenerate`). |

## Ablauf

1. Das Dashboard-Widget (oder der Lektionsabschluss) ruft
   `getStorage().missions.getDaily(userId, {todayIso})`.
2. Existieren für den lokalen Tag keine Zeilen, weist der
   Generator ein frisches Set zu (geseedet aus `userId + date`,
   ohne die von gestern).
3. Der Fortschritt wird gegen bestehende Daten neu ausgewertet
   (LessonProgress / ElementError / Serie). Eine neu
   abgeschlossene Mission setzt `completed` und vergibt einmalig
   ihre `xp_reward` (idempotent über `xp_awarded`).
4. `celebrateMissions` (Celebration-Bus) spielt den Missions-Ton +
   zeigt eine Lob-Phrase; ein All-clear spielt den größeren Ton +
   einen Konfetti-Regen.

## Regeln

- Deterministisch pro (userId, Datum); ein Nutzer verwendet einen
  Speicher-Modus, daher ist exakte Backend-übergreifende Parität
  nicht erforderlich.
- Kein Tracking über `UserMission` hinaus; nicht-trackbare Checks
  werden nicht zugewiesen.
- Missionen sind ergänzend - ein Fehler unterbricht nie den
  Lektions-Ablauf (alle Lesezugriffe sind defensiv). Keine Strafe
  für verpasste Tage.
