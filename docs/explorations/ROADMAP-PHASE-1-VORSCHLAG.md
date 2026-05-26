# ROADMAP-VORSCHLAG: Phase 1 (Lokal-First MVP)

**Zweck:** Konkreter Vorschlag zur Erweiterung der bestehenden `ROADMAP.md` mit Tasks aus den 17 EXPs.

**Verwendung:** Die unten aufgeführten Tasks ergänzen die bestehenden 62 Tasks. Nummerierung beginnt bei `*-100`, damit Konflikte vermieden werden. Bei Übernahme können die Nummern an deine bestehende Konvention angepasst werden.

**Zeitschätzung Phase 1:** 3-6 Monate Solo-Entwicklung bei regelmäßiger Arbeit.

**Tipp für Claude-Code-Nutzung:** Mit dem "weiter"-Pattern (siehe deine `ai-workflow`-Rules) kannst du die Tasks der Reihe nach abarbeiten lassen. Claude Code liest die ROADMAP, identifiziert die erste offene Task und wartet auf Bestätigung vor der Umsetzung.

---

## Vorbereitende Arbeiten (Sprint 1: Tests-Infrastruktur)

Bevor Features umgesetzt werden, sollte die Test-Basis stehen. Sonst entsteht Technical Debt, der später nicht aufholbar ist.

### Setup

- **S-100** Test-Infrastruktur einrichten: pytest, pytest-cov, pytest-asyncio, hypothesis, freezegun für Python; vitest, @testing-library/react, msw für Frontend
- **S-101** GitHub Actions Pipeline für Pull Requests einrichten (lint, type-check, unit, integration)
- **S-102** GitHub Actions Pipeline für Main-Branch (zusätzlich Performance-Smoke und E2E)
- **S-103** Coverage-Reporting in CI mit Schwellenwerten (Kern-Algorithmen 95%, Plugins 90%, UI 70%)
- **S-104** LLM-Mock-Layer als wiederverwendbare Test-Utility für alle `ai-*`-Plugins
- **S-105** Test-Fixtures: Beispiel-User mit Lernhistorie, Beispiel-Lektionen, Beispiel-Karten
- **S-106** Zeit-Mocking-Konventionen mit freezegun (für SRS, Streaks, Missionen)

### DevOps und Doku

- **D-100** Testing-Guide für Contributor (`docs/TESTING.md`)
- **D-101** Test-Plan-Template definieren
- **D-102** Test-Case-Template definieren
- **D-103** Bug-Report-Template in `.github/ISSUE_TEMPLATE/` integrieren
- **D-104** Dogfooding-Plan: tägliche Eigennutzung etablieren, Findings in Issue-Tracker

---

## Sprint 2: Content-System-Fundament

### Plugin: Content-Loader

- **P-100** Plugin-Skelett `content-loader` (PluginForge-basiert)
- **P-101** Pydantic-Modelle für Set und Manifest
- **P-104** Manifest-Parser und Schema-Validierung
- **P-105** Download- und Cache-Logik mit Versionsabgleich
- **P-106** GitHub-Adapter (Raw URL Fetcher mit optionalem Token)

### Tests

- **Q-100** Tests für Cache-Invalidierung
- **Q-101** Tests für Schema-Validierung (Content-Loader)

### DevOps und erstes Content-Repo

- **D-105** Content-Repo `astrapi69/adaptive-learner-content` aufsetzen
- **D-106** 2-3 Beispiel-Sets erstellen (FR A1 als Pilot)

---

## Sprint 3: Lektionsformat

### Plugin: Lesson-Loader

- **P-102** Pydantic-Modelle für Lesson, Cards, Exercises (Schema v1.0)
- **P-103** JSON-Schema-Export für externe Editor-Validierung
- **P-107** Lesson-Loader mit referenzieller Integritätsprüfung
- **P-108** Markdown-Parser mit Anker-Auflösung (`theory.md#section`)
- **P-109** State-Persistierung für Lesson-Fortschritt im `session`-Plugin

### Frontend

- **F-102** Lesson-Viewer mit Step-Navigation
- **F-103** Fortschrittsanzeige (z.B. "Schritt 3 von 8")

### Tests und Content

- **Q-102** Tests für referenzielle Integrität
- **Q-103** Tests für Schema-Versionskompatibilität
- **D-107** Pilot-Lektion `fr-a1-lektion-01-begruessung` erstellen
- **D-108** CI-Workflow im Content-Repo: Schema-Validierung bei PR

---

## Sprint 4: Modi-System und Domänen

### Plugin: Domain-Architecture

- **P-110** Schema-Refactoring: Domain-Feld, generische `front`/`back` statt sprachspezifischer Felder
- **P-111** Domain-Plugin-Interface definieren
- **P-112** `domain-language`-Plugin als Referenzimplementierung
- **P-113** Modus-Erkennung im Bootstrap (mit/ohne API-Key)
- **P-114** Distraktoren aus Pool statt AI-Generierung im Content-Modus
- **P-115** Stock-Foto-Adapter (Pixabay, Unsplash) für Bilder

### Frontend

- **F-100** UI für Set-Auswahl (Browser, Filter nach Sprache/Level)
- **F-101** UI für Download-Status und Update-Benachrichtigung
- **F-104** UI-Indikator für Betriebsmodus (Content-only vs. AI-augmented)
- **F-105** Settings-Page für optionale API-Key-Hinterlegung

### Tests und Content

- **Q-104** Tests für beide Modi (Content-only und AI-augmented)
- **D-109** Pilot-Repo `content-math` mit einer Beispiel-Lektion

---

## Sprint 5: Übungstypen Basis (Matching und Picture Choice)

### Plugin: Exercises

- **P-116** Plugin-Skelett `exercises` mit Hook-Interface
- **P-117** Wortauswahl-Strategie mit SRS-Integration (`tracking`)
- **P-118** Bildservice mit Cache und AI-Fallback
- **P-119** Distraktoren-Logik (semantische Cluster)

### Frontend

- **F-106** React-Komponente Matching (zwei Spalten, Drag/Tap)
- **F-107** React-Komponente Picture Choice

### Tests und i18n

- **Q-105** Tests für Wortauswahl-Strategie
- **Q-106** Tests für Distraktoren-Qualität
- **I-100** i18n für Übungsanweisungen (DE, FR, EN)

---

## Sprint 6: Erweiterte Übungstypen (Freitext und Word Tiles)

### Plugin-Erweiterungen

- **P-120** Übungstyp `free_text`: Schema und Validator
- **P-121** Freitext-Bewertung: Levenshtein-Distanz, Normalisierung
- **P-122** Freitext-Bewertung: AI-Fallback im Hybrid-Modus
- **P-123** Übungstyp `word_tiles`: Schema und Validator
- **P-124** Word-Tiles-Bewertung mit Alternativen-Support
- **P-125** `exercise_block`-Typ in Lesson-Schema

### Frontend

- **F-108** React-Komponente Freitext-Input mit Submit-Auswertung
- **F-109** React-Komponente Word Tiles (Drag und Tap)
- **F-110** Lesson-Sequenz-UI mit Fortschritts-Anzeige (X/10)

### Tests

- **Q-107** Tests für Levenshtein-Toleranz und Edge-Cases
- **Q-108** Tests für Word-Tiles mit Alternativen
- **Q-109** Tests für Lektions-Sequenz-Persistierung

---

## Sprint 7: Fehlergranulare Wiederholung

### Plugin: Error-Tracking-Kern

- **P-126** Token-Diff-Modul (Wrapper um `difflib.SequenceMatcher`)
- **P-127** Cloze-Generator aus Diff-Ergebnis
- **P-128** Lektions-Logik: Korrektur-Block am Lektionsende einfügen
- **P-129** SRS-Erweiterung: Element-Level statt Karten-Level (wichtig für EXP-013!)
- **P-130** Token-Rollen-Schema in Card-Definition

### Frontend

- **F-111** UI-Komponente Cloze-Eingabe (Lücken-Felder im Satz)
- **F-112** Visuelles Diff-Highlighting (richtig grün, falsch rot)
- **F-113** Korrektur-Block am Lektionsende mit klarer Anzeige

### Tests

- **Q-110** Tests für Diff-Algorithmus mit Edge-Cases
- **Q-111** Tests für Cloze-Generierung
- **Q-112** Tests für mehrere Fehler in einem Satz

---

## Sprint 8: Erste Manuelle Tests und Beta-Vorbereitung

Nach Sprint 7 ist die App lokal benutzbar. Jetzt Validierung mit echten Menschen.

### Manuelle Tests starten

- **D-122** Erste Hallway-Tests mit Familie/Freunden (5-10 Personen, je 15 Min)
- **D-123** Beta-Tester-Kriterien definieren
- **D-124** Onboarding-Prozess für Beta-Tester
- **D-125** Feedback-Sammlung systematisieren (regelmäßige Surveys)

### Erste Querschnitts-Tests

- **Q-125** Performance-Test-Suite für kritische Endpoints
- **Q-126** Accessibility-Testing-Setup mit axe-core
- **Q-128** E2E-Test-Setup mit Playwright (zentrale User-Journeys)

---

## Meilenstein Phase 1: Definition of Done

Phase 1 ist abgeschlossen, wenn folgendes erfüllt ist:

1. **Funktional**
   - App lokal startbar ohne API-Key (Content-Modus)
   - Mindestens 5 vollständige Pilot-Lektionen verfügbar
   - Alle 4 Übungstypen funktionieren (Matching, Picture Choice, Freitext, Word Tiles)
   - Fehlergranulare Wiederholung mit Cloze funktioniert
   - SRS auf Element-Level vorhanden

2. **Qualität**
   - Test-Coverage über Schwellenwerten (Kern 95%, Plugins 90%, UI 70%)
   - Mindestens 5 Hallway-Tests durchgeführt, kritische Findings adressiert
   - E2E-Tests für 5 zentrale User-Journeys grün
   - Accessibility-Mindeststandards erfüllt

3. **Infrastruktur**
   - Content-Repo aktiv, mindestens 2 Sprachen oder Domänen
   - CI grün auf Main-Branch
   - Testing-Guide und Contributing-Guide vorhanden

4. **Validation**
   - Mindestens 3 echte Nutzer haben mehrere Lektionen abgeschlossen
   - Subjektives Feedback: App "fühlt sich richtig an"

---

## Anschluss: Was kommt nach Phase 1

Nach erfolgreicher Phase 1 stehen folgende Sprints in Phase 2 an:

- **Adaptive Lektionen (EXP-013)** als zentrales Feature
- **Lob und Celebration (EXP-008)** als Engagement-Schicht
- **GitHub-Organisation (EXP-004)** für Wachstum
- **Community-Feedback (EXP-014)** für nachhaltige Entwicklung

Details siehe `BACKLOG.md`.

---

## Wichtige Hinweise

### Was NICHT in Phase 1 ist (bewusst aufgeschoben)

- Soziale Features (EXP-009): brauchen Cloud-Backend, viel zu früh
- Ranglisten, Turniere (EXP-011, EXP-012): siehe oben
- Kinder-Variante (EXP-015): erst nach Stabilisierung der Erwachsenen-Variante
- AI-augmentierte Pattern-Erkennung (EXP-013 Stufe 3): Stufe 1 und 2 reichen
- PDF-Zertifikate, Sound-System: nice to have, nicht MVP

### Was AUS der bestehenden ROADMAP.md erhalten bleibt

Diese Roadmap-Erweiterung **ersetzt nicht** die bestehenden 62 Tasks (S, B, P, F, I, Q, D). Sie ergänzt sie. Bevor du Tasks ab `*-100` einsortierst, prüfe:

- Welche bestehenden Tasks decken bereits Punkte aus den EXPs ab?
- Wo gibt es Überschneidungen, die konsolidiert werden sollten?
- Welche Reihenfolge in der bestehenden ROADMAP.md passt nicht mehr zur neuen Phasen-Struktur?

Vorschlag: Die bestehende ROADMAP.md daraufhin durchsehen und ggf. um die hier vorgeschlagenen Tasks erweitern. Bei Konflikten: Bestehende Implementierungen haben Vorrang, EXPs werden angepasst.

### Realistische Erwartungen

- **Sprint-Länge:** 1-3 Wochen je nach Komplexität
- **Phase 1 gesamt:** 3-6 Monate
- **Hobby-Tempo:** ggf. 6-12 Monate
- **Jeder Sprint:** Inklusive Tests, Doku, Refactoring

Wenn das zu viel wird, ist das ein Signal zur weiteren Priorisierung. Lieber weniger Features sauber, als viele halbfertig.
