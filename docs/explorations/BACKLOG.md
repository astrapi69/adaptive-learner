# BACKLOG: Adaptive Learner

**Stand:** 2026-05-26
**Quelle:** Konsolidiert aus EXP-001 bis EXP-017
**Nummerierung:** Tasks beginnen ab `*-100`, damit Konflikte mit bestehender ROADMAP.md (1-62) vermieden werden. Bei Übernahme in `ROADMAP.md` Nummern anpassen.

## Kategorien-Legende

| Prefix | Bedeutung                                          |
| ------ | -------------------------------------------------- |
| S      | Setup (Repo, Tooling, Boilerplate)                 |
| B      | Backend (FastAPI, DB, Server-Logik)                |
| P      | Plugin (PluginForge-basierte Module)               |
| F      | Frontend (React/TypeScript Komponenten und UIs)    |
| Q      | Quality (Tests aller Art)                          |
| D      | DevOps (CI/CD, Hosting, Repos, Doku, Content)      |
| I      | i18n (Übersetzungen, lokalisierte Inhalte)         |
| Lib    | Externe Library (eigenes PyPI-Paket)               |

---

# Phase 1: Lokal-First MVP

Ziel: App lokal nutzbar mit echtem Lerneffekt, ohne Server-Backend. Adaptive Kernfeature beginnt zu wirken.

## Setup und Test-Infrastruktur (parallel zu allen Features)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| S-100 | Test-Infrastruktur: pytest, vitest, playwright einrichten  | 016 |
| S-101 | CI-Pipeline für Pull Requests (GitHub Actions)             | 016 |
| S-102 | CI-Pipeline für Main-Branch                                | 016 |
| S-103 | Coverage-Reporting mit Schwellenwerten                     | 016 |
| S-104 | LLM-Mock-Layer als wiederverwendbare Test-Utility          | 016 |
| S-105 | Test-Fixtures: Beispiel-User, -Lektionen, -Karten          | 016 |
| S-106 | Zeit-Mocking-Konventionen (freezegun)                      | 016 |
| D-100 | Testing-Guide für Contributor                              | 016 |
| D-101 | Test-Plan-Template definieren                              | 017 |
| D-102 | Test-Case-Template definieren                              | 017 |
| D-103 | Bug-Report-Template in GitHub-Issues                       | 017 |
| D-104 | Dogfooding-Plan: tägliche Eigennutzung etablieren          | 017 |

## Content-Repository (EXP-002, EXP-003)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-100 | Plugin-Skelett `content-loader`                            | 002 |
| P-101 | Pydantic-Modelle für Set und Manifest                      | 002 |
| P-102 | Pydantic-Modelle für Lesson, Cards, Exercises (Schema v1.0) | 003 |
| P-103 | JSON-Schema-Export für Editor-Validierung                  | 003 |
| P-104 | Manifest-Parser und Schema-Validierung                     | 002 |
| P-105 | Download- und Cache-Logik mit Versionsabgleich             | 002 |
| P-106 | GitHub-Adapter (Raw URL Fetcher mit optionalem Token)      | 002 |
| P-107 | Lesson-Loader mit referenzieller Integritätsprüfung        | 003 |
| P-108 | Markdown-Parser mit Anker-Auflösung (`theory.md#section`)  | 003 |
| P-109 | State-Persistierung für Lesson-Fortschritt (`session`)     | 003 |
| F-100 | UI für Set-Auswahl (Browser, Filter nach Sprache/Level)    | 002 |
| F-101 | UI für Download-Status und Update-Benachrichtigung         | 002 |
| F-102 | Lesson-Viewer mit Step-Navigation                          | 003 |
| F-103 | Fortschrittsanzeige (z.B. "Schritt 3 von 8")               | 003 |
| Q-100 | Tests für Cache-Invalidierung                              | 002 |
| Q-101 | Tests für Schema-Validierung                               | 002 |
| Q-102 | Tests für referenzielle Integrität                         | 003 |
| Q-103 | Tests für Schema-Versionskompatibilität                    | 003 |
| D-105 | Content-Repo `astrapi69/adaptive-learner-content` aufsetzen | 002 |
| D-106 | 2-3 Beispiel-Sets erstellen (FR A1 als Pilot)              | 002 |
| D-107 | Pilot-Lektion `fr-a1-lektion-01-begruessung` erstellen     | 003 |
| D-108 | CI-Workflow im Content-Repo: Schema-Validierung bei PR     | 003 |

## Modi und Domänen (EXP-005)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-110 | Schema-Refactoring: Domain-Feld, generische `front`/`back` | 005 |
| P-111 | Domain-Plugin-Interface definieren                         | 005 |
| P-112 | `domain-language`-Plugin als Referenzimplementierung       | 005 |
| P-113 | Modus-Erkennung im Bootstrap (mit/ohne API-Key)            | 005 |
| P-114 | Distraktoren aus Pool statt AI-Generierung im Content-Modus | 005 |
| P-115 | Stock-Foto-Adapter (Pixabay, Unsplash) für Bilder          | 005 |
| F-104 | UI-Indikator für Betriebsmodus                             | 005 |
| F-105 | Settings-Page für optionale API-Key-Hinterlegung           | 005 |
| Q-104 | Tests für beide Modi (Content-only und AI-augmented)       | 005 |
| D-109 | Pilot-Repo `content-math` mit einer Beispiel-Lektion       | 005 |

## Übungstypen (EXP-001, EXP-006)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-116 | Plugin-Skelett `exercises` mit Hook-Interface              | 001 |
| P-117 | Wortauswahl-Strategie mit SRS-Integration                  | 001 |
| P-118 | Bildservice mit Cache und AI-Fallback                      | 001 |
| P-119 | Distraktoren-Logik (semantische Cluster)                   | 001 |
| P-120 | Übungstyp `free_text`: Schema und Validator                | 006 |
| P-121 | Freitext-Bewertung: Levenshtein-Distanz, Normalisierung    | 006 |
| P-122 | Freitext-Bewertung: AI-Fallback im Hybrid-Modus            | 006 |
| P-123 | Übungstyp `word_tiles`: Schema und Validator               | 006 |
| P-124 | Word-Tiles-Bewertung mit Alternativen-Support              | 006 |
| P-125 | `exercise_block`-Typ in Lesson-Schema                      | 006 |
| F-106 | React-Komponente Matching (zwei Spalten, Drag/Tap)         | 001 |
| F-107 | React-Komponente Picture Choice                            | 001 |
| F-108 | React-Komponente Freitext-Input mit Submit-Auswertung      | 006 |
| F-109 | React-Komponente Word Tiles (Drag und Tap)                 | 006 |
| F-110 | Lesson-Sequenz-UI mit Fortschritts-Anzeige (X/10)          | 006 |
| Q-105 | Tests für Wortauswahl-Strategie                            | 001 |
| Q-106 | Tests für Distraktoren-Qualität                            | 001 |
| Q-107 | Tests für Levenshtein-Toleranz und Edge-Cases              | 006 |
| Q-108 | Tests für Word-Tiles mit Alternativen                      | 006 |
| Q-109 | Tests für Lektions-Sequenz-Persistierung                   | 006 |
| I-100 | i18n für Übungsanweisungen (DE, FR, EN)                    | 001 |

## Fehlergranulare Wiederholung (EXP-007)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-126 | Token-Diff-Modul (Wrapper um `difflib.SequenceMatcher`)    | 007 |
| P-127 | Cloze-Generator aus Diff-Ergebnis                          | 007 |
| P-128 | Lektions-Logik: Korrektur-Block am Ende einfügen           | 007 |
| P-129 | SRS-Erweiterung: Element-Level statt Karten-Level          | 007 |
| P-130 | Token-Rollen-Schema in Card-Definition                     | 007 |
| F-111 | UI-Komponente Cloze-Eingabe (Lücken-Felder im Satz)        | 007 |
| F-112 | Visuelles Diff-Highlighting (richtig grün, falsch rot)     | 007 |
| F-113 | Korrektur-Block am Lektionsende mit klarer Anzeige         | 007 |
| Q-110 | Tests für Diff-Algorithmus mit Edge-Cases                  | 007 |
| Q-111 | Tests für Cloze-Generierung                                | 007 |
| Q-112 | Tests für mehrere Fehler in einem Satz                     | 007 |

---

# Phase 2: Adaptive Core und Community-Fundament

Ziel: Das Kern-Versprechen "Adaptive Learning" einlösen. Community-Strukturen aufbauen.

## Adaptive Lektionen Stufe 1 und 2 (EXP-013)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-131 | Error-Record-Datenmodell im `tracking`-Plugin              | 013 |
| P-132 | Fehler-Erfassung in allen Übungstypen                      | 013 |
| P-133 | Element-Stats-Aggregation                                  | 013 |
| P-134 | Priority-Score-Berechnung                                  | 013 |
| P-135 | Element-Cleanup nach "gemeistert"-Status                   | 013 |
| P-136 | Regelbasierte Pattern-Erkennung (Frequenz, Tag-Cluster)    | 013 |
| P-137 | Lektions-Generator mit Übungstyp-Mix                       | 013 |
| P-138 | Variations-Logik für Kontext-Varianz                       | 013 |
| P-139 | Fehler-Klassifikations-Schema in `domain-language`         | 013 |
| P-140 | Tag-Schema für sprach-spezifische Elemente                 | 013 |
| F-114 | Dashboard-Komponente "Übungsschwerpunkt"                   | 013 |
| F-115 | Transparenz-Anzeige vor der Lektion                        | 013 |
| F-116 | Verbesserungs-Anzeige nach der Lektion                     | 013 |
| Q-113 | Tests für Fehler-Erfassung in allen Übungstypen            | 013 |
| Q-114 | Tests für Aggregations-Logik                               | 013 |
| Q-115 | Tests für Generator-Logik                                  | 013 |
| Q-116 | Tests für Edge-Cases (zu wenig Fehler, etc.)               | 013 |
| D-110 | Content-Repo-Tags: Pilot-Lektion mit voll annotierten Elementen | 013 |

## Lob und Celebration (EXP-008)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-141 | Plugin-Skelett `feedback`                                  | 008 |
| P-142 | Lob-Phrasen-System mit i18n und Variation                  | 008 |
| P-143 | Event-System: on_correct, on_complete, on_milestone        | 008 |
| P-144 | Streak-Tracking im `tracking`-Plugin                       | 008 |
| P-145 | Statistik-Aggregation (Trefferquoten, Wortschatzwachstum)  | 008 |
| F-117 | Mikro-Animationen für Antworten (CSS oder Framer Motion)   | 008 |
| F-118 | Celebration-Screen am Lektionsende                         | 008 |
| F-119 | Milestone-Screens (Streaks, Word-Count)                    | 008 |
| F-120 | Settings-UI für Feedback-Intensität                        | 008 |
| F-121 | Sound-System mit Mute-Toggle (optional, default off)       | 008 |
| I-101 | Lob-Phrasen-Pool in DE, FR, EN                             | 008 |
| Q-117 | Tests für Lob-Phrasen-Variation (keine Wiederholung in Folge) | 008 |

## GitHub-Organisation (EXP-004)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| D-111 | GitHub-Organisation `adaptive-learner` anlegen             | 004 |
| D-112 | Org-Profil mit README, Code of Conduct, Contributing-Guide | 004 |
| D-113 | Lizenz-Strategie finalisieren (Code MIT, Content CC-BY-SA) | 004 |
| D-114 | Hauptrepo `astrapi69/adaptive-learner` zur Org transferieren | 004 |
| D-115 | Lokale Clones und CI-Settings aktualisieren                | 004 |
| D-116 | Repo `content-registry` anlegen mit initialer `registry.yaml` | 004 |
| D-117 | Repo `content-fr` anlegen mit Schema-Stubs                 | 004 |
| P-146 | Loader-Anpassung: Registry-Mechanismus                     | 004 |
| P-147 | Loader-Caching für Registry und Content-Repos              | 004 |
| Q-118 | Integrationstests für Multi-Repo-Loading                   | 004 |

## Community-Feedback Phase 1 (EXP-014)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| D-118 | GitHub-Issue-Templates für Feature, Bug, Content           | 014 |
| D-119 | GitHub-Discussions im Repo aktivieren                      | 014 |
| D-120 | Public Project-Roadmap einrichten                          | 014 |
| D-121 | Stale-Bot für Issue-Lifecycle                              | 014 |
| P-148 | Plugin `feedback-channel` mit GitHub-Link-Integration      | 014 |
| F-122 | Settings-Bereich "Mitwirken" mit Links                     | 014 |
| F-123 | Quick-Feedback-Widget pro Karte (optional einblendbar)     | 014 |
| F-124 | Settings für Widget-Frequenz                               | 014 |
| P-149 | Lokale Sammlung von Feedback-Events                        | 014 |

## Manuelle Tests starten (EXP-017)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| D-122 | Erste Hallway-Tests mit Familie/Freunden                   | 017 |
| D-123 | Beta-Tester-Kriterien definieren                           | 017 |
| D-124 | Onboarding-Prozess für Beta-Tester                         | 017 |
| D-125 | Feedback-Sammlung systematisieren                          | 017 |

## Adaptive Lektionen Stufe 3 (optional, später in Phase 2)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-150 | AI-Adapter für Pattern-Analyse                             | 013 |
| P-151 | Lerntheoretisch fundierte Erklärungs-Generierung           | 013 |
| P-152 | AI-generierte Übungs-Variationen für neue Kontexte         | 013 |
| F-125 | Detail-Ansicht mit AI-Erklärungen (optional aufrufbar)     | 013 |

## Übungsrichtung - Rezeptiv vs. Produktiv (EXP-018)

Stufe 1 (Fundament) und Stufe 2 (Renderer) sind die Pflicht; Stufe 3
(Scheduling/Adaption) und Stufe 4 (Inhalt/UI/Doku) bauen darauf auf.
**Geliefert in Phase 62 / v1.46.0** (alle Stufen).

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-167 | `direction`-Feld auf Exercise-Schema (4 Werte, Default rezeptiv, additiv 1.2) | 018 |
| P-168 | `ElementError` pro Richtung: Spalte + Composite-Uniqueness + Migration + Backfill + Sync | 018 |
| F-146 | `resolveCardDisplay()` + richtungsbewusste Anzeige in allen 5 Renderern (Cloze ausgenommen) | 018 |
| P-169 | Richtungsbewusste Review-Queue mit Produktiv-Gewichtung (1,2x) + Mastery-Filter | 018 |
| P-170 | Adaptiver Generator: `direction_strategy` (auto/receptive_first/productive_focus/balanced) | 018 |
| D-140 | Pilot-Lektionen: progressive Richtung (rezeptiv -> produktiv) + Content-Repo-Spiegelung | 018 |
| F-147 | Richtungs-Indikator (Auge/Stift), Split-Statistiken, Einstellung "Bevorzugte Übungsrichtung" | 018 |
| D-141 | Doku + Hilfe-Glossar-Eintrag "Übungsrichtung" + Authoring-Guide (`direction`-Feld) | 018 |

---

# Phase 3: Gamification (mit Augenmaß)

Ziel: Motivations-Features als unterstützendes Beiwerk, nicht als Haupt-Schwerpunkt.

## XP-System lokal (EXP-009 Stufe 1)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-153 | XP-System im `tracking`-Plugin                             | 009 |
| P-154 | XP-Berechnungs-Regeln und Konfiguration                    | 009 |
| F-126 | XP-Anzeige in der UI (Header, Profil)                      | 009 |
| F-127 | XP-Verlauf und Statistik                                   | 009 |
| Q-119 | Tests für XP-Berechnung                                    | 009 |

## Missionen und Plaketten (EXP-010)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-155 | Plugin-Skelett `missions`                                  | 010 |
| P-156 | Mission-Definitions-Schema (Pydantic)                      | 010 |
| P-157 | Mission-Generator: statischer Pool plus Tagesauswahl       | 010 |
| P-158 | Plaketten-System mit Hierarchie und Upgrade-Logik          | 010 |
| P-159 | Reset-Logik mit Zeitzonen-Berücksichtigung                 | 010 |
| P-160 | Streak-Joker-Mechanik                                      | 010 |
| P-161 | Integration ins `feedback`-Plugin für Celebration          | 010 |
| F-128 | UI-Komponente "Heutige Missionen" auf der Startseite       | 010 |
| F-129 | Plaketten-Galerie im Profil                                | 010 |
| F-130 | Fortschritts-Anzeige pro Mission (Progress Bar)            | 010 |
| F-131 | Settings-Page für Mission-Konfiguration                    | 010 |
| D-126 | Initial-Set von 20-30 Mission-Templates erstellen          | 010 |
| D-127 | Plaketten-SVG-Designs erstellen                            | 010 |
| Q-120 | Tests für Reset-Logik bei verschiedenen Zeitzonen          | 010 |
| Q-121 | Tests für adaptive Schwierigkeitsberechnung                | 010 |
| Q-122 | Tests für Plaketten-Upgrade-Logik                          | 010 |
| I-102 | Mission- und Plaketten-Texte in DE, FR, EN                 | 010 |
| P-162 | Mission-Generator: adaptive Schwierigkeit nach Historie    | 010 |

## Zusätzliche Engagement-Features

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| D-128 | PDF-Zertifikat-Generierung für Level-Abschluss             | 008 |

---

# Phase 4: Cloud-Backend und Soziale Features

Ziel: Plattform-Erweiterung mit Server-Backend. Voraussetzung: validierte Nutzerbasis aus Phasen 1-3.

## Backend-Fundament (EXP-009 Stufe 2)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| B-100 | Backend-Server-Setup (FastAPI, Postgres, Docker)           | 009 |
| B-101 | Auth-System mit GitHub-OAuth                               | 009 |
| B-102 | User-Profile (CRUD)                                        | 009 |
| B-103 | Sync-Endpoints für SRS-State und XP                        | 009 |
| F-132 | Login-Flow und Profil-UI                                   | 009 |
| F-133 | Sync-Status-Indikator                                      | 009 |
| D-129 | Hosting-Setup mit CI/CD (Fly.io, Hetzner, oder Railway)    | 009 |
| D-130 | Datenschutz-Erklärung schreiben                            | 009 |

## Soziale Basis-Features (EXP-009 Stufe 3)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| B-104 | Friend-Modell (Friend Requests, Accept/Decline)            | 009 |
| B-105 | Mentoring-Beziehungen mit Status                           | 009 |
| B-106 | Aktivitäts-Feed-Generierung                                | 009 |
| B-107 | Privacy-Settings pro Beziehungstyp                         | 009 |
| F-134 | Freunde-Liste und Profile-Detail                           | 009 |
| F-135 | Mentoring-UI                                               | 009 |
| F-136 | Aktivitäts-Feed-Komponente                                 | 009 |

## Profile und Likes (EXP-012)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-163 | Plugin `profile` mit Datenmodell                           | 012 |
| B-108 | Privacy-Filter im API-Layer                                | 012 |
| F-137 | Profil-Bearbeitung im Settings-Bereich                     | 012 |
| F-138 | Public-Profile-Ansicht für andere User                     | 012 |
| B-109 | Optional: Markdown-Export für Public-Profile               | 012 |
| D-131 | Optional: Auto-Sync zu separatem `profiles`-Repo           | 012 |

## Telemetrie (EXP-014 Phase 2, optional)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| P-164 | Plugin `telemetry` mit strikt opt-in                       | 014 |
| P-165 | Anonymisierungs-Logik                                      | 014 |
| P-166 | Lokale Vorverarbeitung                                     | 014 |
| B-110 | Server-Endpoint für Aggregate                              | 014 |
| B-111 | Auswertungs-Dashboard für Maintainer                       | 014 |
| F-139 | Transparente Settings-UI mit Datenliste                    | 014 |

## Ranglisten und Liga-System (EXP-011)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| B-112 | Leaderboard-Aggregations-Service                           | 011 |
| B-113 | API-Endpoints für Ranglisten pro Domäne                    | 011 |
| B-114 | Liga-System mit Cutoffs                                    | 011 |
| F-140 | Leaderboard-UI mit Tab-Navigation pro Domäne               | 011 |
| F-141 | "Deine Position"-Anzeige (Liga-basiert)                    | 011 |
| Q-123 | Tests für Aggregations-Logik                               | 011 |
| Q-124 | Tests für Privacy-Filter                                   | 011 |
| B-115 | Saison-Lifecycle (3 Monats-Zyklen)                         | 011 |
| B-116 | Auf-/Abstiegslogik nach Saisonende                         | 011 |
| B-117 | Saison-spezifische Plaketten verleihen                     | 011 |
| F-142 | Liga-Anzeige im Profil                                     | 011 |
| F-143 | Saison-Countdown und -Übergang                             | 011 |

## Spezialisierte Manuelle Tests (EXP-017 Phase 3)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| D-132 | Native Speaker für Sprach-Content gewinnen                 | 017 |
| D-133 | Pädagogische Beratung (für Inhaltsqualität)                | 017 |
| D-134 | Accessibility-Audit mit Betroffenen                        | 017 |
| D-135 | Datenschutz-Review                                         | 017 |

---

# Phase 5: Spezialisierungen

## Turnier-Library als eigenes Projekt (EXP-012)

| ID      | Task                                                       | EXP |
| ------- | ---------------------------------------------------------- | --- |
| Lib-100 | Repo-Skelett unter `astrapi69/tournamentforge`             | 012 |
| Lib-101 | Kern-Datenmodelle mit Pydantic                             | 012 |
| Lib-102 | Match-Making-Algorithmen                                   | 012 |
| Lib-103 | Bracket-Generierung                                        | 012 |
| Lib-104 | Payout-Strategien als Plugin-Pattern                       | 012 |
| Lib-105 | Anti-Cheat-Hook-Interface                                  | 012 |
| Lib-106 | Tests mit hoher Coverage                                   | 012 |
| Lib-107 | Dokumentation und Beispiel-App                             | 012 |
| Lib-108 | PyPI-Release v0.1.0                                        | 012 |
| Lib-109 | Integration in Adaptive Learner als erster Konsument       | 012 |

## Kinder-Variante (EXP-015)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| D-136 | Strategische Entscheidung: Option A/B/C                    | 015 |
| D-137 | Konzept-Design mit Maskottchen, Style-Guide                | 015 |
| D-138 | Pilot-Inhalt für eine Altersgruppe (z.B. 5-8)              | 015 |
| F-144 | UX-Prototypen, Eltern-Modus-MVP                            | 015 |
| D-139 | Beta-Test mit 5-10 Familien                                | 015 |

---

# Laufende Querschnitts-Tasks (alle Phasen)

## Automatisierte Tests (EXP-016)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| Q-125 | Performance-Test-Suite für kritische Endpoints             | 016 |
| Q-126 | Accessibility-Testing-Setup mit axe-core                   | 016 |
| Q-127 | Mutation-Testing für SRS und Token-Diff                    | 016 |
| Q-128 | E2E-Test-Setup mit Playwright                              | 016 |
| Q-129 | Property-Based-Tests für Kern-Algorithmen mit hypothesis   | 016 |

## Manuelle Tests Erweiterung (EXP-017)

| ID    | Task                                                       | EXP |
| ----- | ---------------------------------------------------------- | --- |
| F-145 | In-App-Beta-Feedback-Widget (optional, Phase 2)            | 017 |
| B-118 | A/B-Test-Infrastruktur im Backend (Phase 4)                | 017 |

---

# Anhang: Tasks pro EXP (Übersicht)

| EXP | Anzahl Tasks | Phase |
| --- | ------------ | ----- |
| 001 | 9            | 1     |
| 002 | 11           | 1     |
| 003 | 11           | 1     |
| 004 | 10           | 2     |
| 005 | 9            | 1     |
| 006 | 12           | 1     |
| 007 | 11           | 1     |
| 008 | 12           | 2     |
| 009 | 25           | 3 (XP) und 4 (Cloud) |
| 010 | 17           | 3     |
| 011 | 13           | 4     |
| 012 | 17           | 4-5   |
| 013 | 22           | 2     |
| 014 | 15           | 1-2 und 4 |
| 015 | 5            | 5     |
| 016 | 11           | laufend |
| 017 | 13           | laufend |

**Total: ca. 223 Tasks**

Diese Zahl wirkt einschüchternd, aber:

- Viele Tasks sind kleine, gut isolierbare Einheiten
- Phase 1 hat ca. 85 Tasks - das ist 3-6 Monate Solo-Arbeit
- Phasen 4 und 5 sind weit in der Zukunft, müssen jetzt nicht im Detail geplant werden
- Querschnitts-Tasks (016, 017) laufen verteilt

## Pragmatische Reihenfolge für Phase 1

Wenn du sofort anfangen willst, empfohlene Reihenfolge der ersten 20 Tasks:

1. S-100 bis S-106 (Test-Infrastruktur)
2. P-100, P-101, P-104 (Content-Loader-Kern)
3. P-102, P-107 (Lesson-Modelle und -Loader)
4. P-110, P-111 (Domain-Schema und Interface)
5. D-105, D-106 (Erstes Content-Repo)
6. P-116, P-117, P-119 (Exercises-Plugin und Wortauswahl)
7. F-106, F-107 (Erste Übungs-UIs)

Damit hast du nach ~6 Wochen die Basis: Content laden, Lektionen rendern, Übungen anzeigen, Tests laufen. Erste manuelle Tests (D-122) können beginnen.
