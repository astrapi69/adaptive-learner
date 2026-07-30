# EXP-INDEX: Übersicht aller Explorations

**Stand:** 2026-07-30 (v2.8.0)
**Anzahl EXPs:** 44 (Zeilen der Uebersichtstabelle; die Nummern 019 und 043
existieren nicht, 001-017 sind in `docs/roadmap-archive/phase-1-complete.md`
archiviert und bleiben als historische Zeilen stehen)

> Vollstaendiger Umsetzungs-Audit (Task-fuer-Task, gegen Code verifiziert):
> [docs/journal/exploration-status-audit.md](../journal/exploration-status-audit.md)
> (Stand 2026-06-17).

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
| 027 | Internationalisierungs-Strategie (Sprach-Expansion) | Querschnitt | Zukunft | Mittel | 002, 023           |
| 028 | User-Event-Recording (Fehlerbericht)        | Querschnitt  | laufend | Mittel | eventRecorder      |
| 029 | Medien-Ressourcen mit Gegenseitigkeits-Prinzip | Vision    | B/C   | Mittel    | 023, 025, #141     |
| 030 | Multi-User-Strategie (lokale Profile → Cloud)  | Querschnitt | gestuft | Mittel  | EXP-009, Sync      |
| 031 | ZIP-Backup-Format (.alb) + Container/Manifest | Feature      | Zukunft | Mittel  | Backup, #642, 005  |
| 032 | Inhaltliche Content-Validierung (Quality)    | Querschnitt  | gestuft | Hoch    | 013, 028, 030, 002 |
| 033 | KI-gestützte Content-Validierung (AI Review) | Querschnitt  | gestuft | Mittel  | 032, 023, 028, 030 |
| 034 | Content Discovery + Suchindex               | Vision       | gestuft | Mittel  | 002, 003, 023, 032 |
| 035 | Vercel AI Elements Integration (AI-UI)      | Feature      | Zukunft | Niedrig | shadcn/ui, Session |
| 036 | KI-Übungsgenerierung aus Theorie-Content    | Feature      | 2     | Hoch      | 013, 021, 033, 018 |
| 037 | Navigation Restructuring (12 → 7 Einträge)  | Querschnitt  | 2     | Hoch      | 022, 034, 032/033  |
| 038 | Passphrase-verschlüsselter Key-Export (.alk) | Feature     | angenommen | -    | 031                |
| 039 | JSON-Schema als Single Source of Truth      | Querschnitt  | laufend | Hoch    | 002, 003, 004      |
| 040 | Directory-Restrukturierung (God-Folders)    | Querschnitt  | abgeschlossen | Mittel | 024 (verwandt)  |
| 041 | Aufgabentyp-Eignung + faire Bewertung       | Querschnitt  | Analyse | Mittel-Hoch | 002, 007, 013, 036 |
| 042 | Content-Engine (kanonisches Format + Adapter) | Querschnitt | ausgeliefert (Boundary + Extraktion) | Mittel-Hoch | 039, 002, 003     |
| 044 | CSS-Vereinheitlichung (Kaskaden-Reparatur + Komponenten-Migration) | Querschnitt | laufend | Sehr hoch | 016, #1467 |
| 045 | Content-ID-Stabilität (Datenintegrität über Content-Updates) | Querschnitt | Analyse | Sehr hoch | 039, 042, 002/003, #2128 |
| 046 | Bearbeiten fremder Inhalte + Autorenzuschreibung | Querschnitt | Analyse | P2/P3 | 023, 025, 026, 045, #2128/#2130 |
| 047 | Vorlesefunktion für alle Aufgabentypen (Auftrag, noch nicht ausgeführt) | Feature | Auftrag | Mittel | 001, 006, #2053 |

## Umsetzungsstand (Stand v1.99.0)

Die Tabelle oben ist ein **Planungs**-Index (Kategorie / Phase / Priorität /
Abhängigkeiten), kein Status-Tracker. Realisierungsstand zum aktuellen Release
(Release-Detail je EXP siehe Phase-History in [ROADMAP.md](../ROADMAP.md) +
[changelog/releases/](../../changelog/releases/)):

- **Ausgeliefert:** 001 (Matching/Picture-Choice), 002 + 005 (Content-Loader),
  003 (Lektionsformat), 006 (Freitext/Word-Tiles), 007 (Fehler-Retry + Cloze),
  008 (Lob/Celebration), 010 (Missionen), 013 (adaptive Lektionen, regelbasiert),
  018 (Übungsrichtung), 020 (Flusssteuerung), 021 (Lektions-Creator),
  022 (visueller Lernpfad), 023 (Multi-Content-Repository A/B/C),
  024 (Layer-Audit Phase 1), **025 teilweise** (Buch-Begleiter: AUTH-01
  Schema/Validator + AUTH-02 Rendering ausgeliefert; AUTH-03..09 Cross-Repo
  zurückgestellt), **026 vollständig** (User-Lektionen im Content-Baum,
  UGC-01..07), **027 teilweise** (Internationalisierung: I18N-02
  Picker-Skalierung + I18N-03 Hindi-UI + I18N-11 Hindi-Content ausgeliefert;
  RTL/weitere Sprachen I18N-01/04/05/06/07/09/10/12 offen),
  **028 vollständig** (User-Event-Recording EVT-01..05, #566),
  **029 vollständig** (Medien-Integration mit Gegenseitigkeits-Prinzip:
  MED-01..07 ausgeliefert — `media.yaml`-Parser + Reziprozitäts-Gate,
  Lektions-Medien-Sektion + `ResourceCard`, Set-Verfügbarkeits-Badges,
  offline-fähige YouTube-Thumbnails, #678/#680/#684/#685/#688; MED-10
  Partner-Onboarding-Doku offen),
  **042 Boundary + Extraktion** (Content-Engine ausgelagert, publiziert und
  konsumiert: `learn-content-engine@0.4.0` in `frontend/package.json`, App-vs-
  Engine-Paritätstest; Content-Repos spiegeln den gepinnten Engine-Release;
  Schema-Hoheit bleibt vorerst in der App-Pydantic; #1311/#1396/#1397; der
  Mehrdatei-Adapter aus Abschnitt 4/7 bleibt Folge-Arbeit).
- **Teilweise (Code begonnen):** **033** (KI-gestützte Content-Validierung:
  AIV-01..05 set-weite Batch-Prüfung + Report-UI + Kosten-Bestätigung,
  AIV-08..11 Content-Hash + Signatur + "AI-Checked"-Badge ausgeliefert,
  #674/#676/#686/#687/#690/#691; offen AIV-06 CI-Action `ai_review.py`,
  AIV-07 Auto-Fix, AIV-12 Signatur-Invalidierung).
- **Laufend (Querschnitt):** 016 (Auto-Tests), 017 (manuelle Tests).
- **Design-Dokumente (noch kein Code):** 031 (.alb-ZIP-Backup, BAK-01..06),
  032 (deterministische Content-Validierung, CQV-01..05),
  034 (Content Discovery + Suchindex, DIS-01..09 — repo-seitiger
  `search-index.json`, client-seitige Suche, Per-Set-Download statt
  Repo-Sync),
  036 (KI-Übungsgenerierung aus Theorie-Content, AIX-01..06 — schließt die
  Lücke Chat-Import → spielbare Lektion: LLM erzeugt Übungen aus reiner
  Prosa-Theorie, beide Storage-Modi) — alle Vorhaben, 0% umgesetzt.
- **Zurückgestellt / Zukunft:** 004 (GitHub-Org), 009/011/012 (soziale Features —
  brauchen Cloud-Backend + Nutzerbasis), 014 (Community-Feedback — teilweise via
  Community-Sharing), 015 (Kinder-Variante),
  030 (Multi-User-Strategie — gestuft: Stufe 1 lokale Profile additiv ab Phase 2,
  Stufe 2 Geräte-Kopplung = Sync, Stufe 3 Cloud-Konten = EXP-009/Phase 4;
  MU-01..05 lokal, MU-20 Cloud).

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
