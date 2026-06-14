# EXP-INDEX: Übersicht aller Explorations

**Stand:** 2026-06-14
**Anzahl EXPs:** 25

## Kategorisierung

| Kategorie    | Beschreibung                                       |
| ------------ | -------------------------------------------------- |
| Feature      | Konkrete Funktionalität mit Plugin-Zuordnung       |
| Querschnitt  | Strategie oder Prozess, der mehrere Features betrifft |
| Vision       | Mittelfristiges Konzept ohne unmittelbare Roadmap-Implikation |

## Übersichtstabelle

| EXP | Titel                                       | Kategorie    | Phase | Priorität | Abhängig von       |
| --- | ------------------------------------------- | ------------ | ----- | --------- | ------------------ |
| 001 | Matching- und Picture-Choice-Übungen        | Feature      | 1     | Hoch      | -                  |
| 002 | Content-Repository                          | Feature      | 1     | Sehr hoch | -                  |
| 003 | Lektionsformat                              | Feature      | 1     | Sehr hoch | 002                |
| 004 | GitHub-Organisation                         | Feature      | 2     | Mittel    | 002, 003           |
| 005 | Offline-Modus und Domänen                   | Feature      | 1     | Sehr hoch | 002, 003           |
| 006 | Freitext und Word Tiles                     | Feature      | 1     | Hoch      | 001, 003           |
| 007 | Fehlergranulare Wiederholung                | Feature      | 1     | Hoch      | 006                |
| 008 | Lob und Celebration                         | Feature      | 2     | Mittel    | 003                |
| 009 | Soziale Features (Phase 2)                  | Feature      | 4     | Niedrig   | 004                |
| 010 | Missionen und Plaketten                     | Feature      | 3     | Mittel    | 008                |
| 011 | Ranglisten und Turniere                     | Feature      | 4     | Niedrig   | 009                |
| 012 | Turnier-Library und soziale Erweiterungen   | Feature      | 4-5   | Niedrig   | 009, 011           |
| 013 | Fehler-basierte adaptive Lektionen          | Feature      | 2     | Sehr hoch | 007, 003           |
| 014 | Community-Feedback und App-Lernen           | Feature      | 1-2   | Hoch      | 004                |
| 015 | Kinder-Variante                             | Vision       | 5     | Mittel    | Phase 1 stabil     |
| 016 | Test-Strategie (automatisiert)              | Querschnitt  | laufend | Sehr hoch | -                |
| 017 | Manuelle Tests                              | Querschnitt  | laufend | Hoch      | 016                |
| 018 | Übungsrichtung - Rezeptiv vs. Produktiv     | Feature      | 2     | Hoch      | 001, 006, 013      |
| 020 | Lektions-Flusssteuerung (Prüfen/Weiter)     | Feature      | 2     | Hoch      | 001, 003, 006      |
| 021 | Lektions-Creator (eigenständig)             | Feature      | 2     | Hoch      | 002, 003, 006, 013 |
| 022 | Visueller Lernpfad (xyflow/React Flow)      | Feature      | Zukunft | Mittel  | 002, 013, 007, 021 |
| 023 | Multi-Content-Repository Architektur        | Vision       | A/B/C | Sehr hoch | 002, 003, 021      |
| 024 | Strikte Schichtentrennung (Layer-Audit)     | Querschnitt  | laufend | Hoch    | -                  |
| 025 | Author-provided Lesson Sets (Buch-Begleiter)| Vision       | B/C   | Niedrig   | 023, 003           |
| 026 | User-Lektionen im Content-Baum (Badge)      | Feature      | 2     | Niedrig   | 023, 025           |

## Phasen-Definition

| Phase | Fokus                                              | Voraussetzung                          |
| ----- | -------------------------------------------------- | -------------------------------------- |
| 1     | Lokal-First MVP: Kernfeatures, Content-System      | Aktueller Stand des Repos              |
| 2     | Adaptive Core, GitHub-Org, Community-Fundament     | Phase 1 stabil                         |
| 3     | Gamification: Lob, Missionen, Plaketten            | Phase 2 stabil                         |
| 4     | Cloud-Backend, Soziale Features                    | Validierte Nutzerbasis aus Phase 1-3   |
| 5     | Spezialisierungen: Kinder-Variante, Library        | Phase 4 stabil                         |

## Querschnitts-Themen (laufend)

EXP-016 und EXP-017 sind keine Features, sondern Strategien, die in **jeder Phase mitlaufen** müssen. Tests gehören nicht ans Ende, sondern parallel zu jedem Feature.

## Abhängigkeits-Graph

```
                        Phase 1
              ┌──────────────────────┐
              │                      │
       EXP-002 (Content-Repo)        │
              │                      │
              ▼                      │
       EXP-003 (Lektionsformat)      │
              │                      │
        ┌─────┴─────┐                │
        ▼           ▼                │
   EXP-005      EXP-001              │
   (Modi)       (Matching, PC)       │
                    │                │
                    ▼                │
              EXP-006 (Freitext, WT) │
                    │                │
                    ▼                │
              EXP-007 (Fehler-Retry) │
              └──────────────────────┘
                       │
                       ▼   Phase 2
              ┌────────┴─────────────────┐
              │                          │
       EXP-013 (Adaptive Lessons)        │
              │                          │
        ┌─────┴─────┐                    │
        ▼           ▼                    │
   EXP-004      EXP-008                  │
   (Org)        (Lob)                    │
        │           │                    │
        │           ▼                    │
        │     EXP-014 (Community)        │
        └──────────────────────────────-─┘
                       │
                       ▼   Phase 3
                  EXP-010 (Missionen)
                       │
                       ▼   Phase 4
              ┌────────┴──────────────┐
              │                       │
       EXP-009 (Cloud, Social)        │
              │                       │
        ┌─────┴─────┐                 │
        ▼           ▼                 │
   EXP-011      EXP-012               │
   (Ranglisten) (Library, Social+)    │
              └────────────────────---┘
                       │
                       ▼   Phase 5
                  EXP-015 (Kinder)

Querschnitt durchgehend: EXP-016 (Auto-Tests), EXP-017 (Manuelle Tests)
```

## Priorisierungs-Logik

**Sehr hoch (MVP-blockend):**

- EXP-002, EXP-003, EXP-005: Ohne Content-System und Modi-Konzept geht nichts
- EXP-013: Ohne Adaptive Kernfeature ist der Name Etikettenschwindel
- EXP-016: Tests sind nicht verhandelbar

**Hoch (MVP-wertvoll):**

- EXP-001, EXP-006, EXP-007: Übungstypen, mit denen die App nutzbar ist
- EXP-014: Community-Fundament für sinnvolle Beta-Phase
- EXP-017: Manuelle Tests für User-Validation

**Mittel (Engagement und Spezialisierung):**

- EXP-004: Org-Migration sinnvoll, aber kein Blocker
- EXP-008, EXP-010: Gamification, schön zu haben
- EXP-015: Kinder-Variante als langfristige Vision

**Niedrig (Phase 2+, viel Aufwand):**

- EXP-009, EXP-011, EXP-012: Soziale Features brauchen Cloud-Backend und Nutzerbasis

## Reiseplan für die nächsten Monate

**Monate 1-2: Fundament**

EXP-002, EXP-003, EXP-005 implementieren. Testing-Infrastruktur (EXP-016) aufbauen. Erste Hallway-Tests (EXP-017).

**Monate 3-4: Übungen und Adaptivität**

EXP-001, EXP-006, EXP-007 implementieren. EXP-013 Stufe 1 (Basis-Tracking) parallel.

**Monate 5-6: Kernfeature einlösen**

EXP-013 Stufe 2 (Lektions-Generator). Erste manuelle Tests mit Beta-Nutzern.

**Monate 7-8: Polish und Community**

EXP-008, EXP-014. Erste öffentliche Beta. Org-Migration (EXP-004).

**Monate 9-12: Engagement-Features**

EXP-010, evtl. Beginn EXP-009 Phase 2.

Realistische Zeitschätzung für Solo-Entwicklung. Bei Hobby-Tempo eher doppelt so lang.
