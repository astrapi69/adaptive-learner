# Exploration-Status-Audit

**Datum:** 2026-06-17 · **App-Version:** v1.85.0 (develop) · **EXPs gesamt:** 32
(Nummern 001-033, EXP-019 existiert nicht) · **Methode:** jedes EXP-Dokument gelesen,
Roadmap-Tasks extrahiert, gegen Code (`grep`, `git log --oneline --all`),
GitHub-Issues (`gh issue list`) und die ausgelieferten Releases verifiziert.

> Audit, kein Bug. Status-Definitionen: **DONE** alle Tasks umgesetzt ·
> **PARTIAL** einige umgesetzt · **OPEN** nichts umgesetzt (aktives Design) ·
> **DEFERRED** bewusst zurueckgestellt (Phase 2+/Vision/extern-gated) ·
> **SUPERSEDED** durch ein neueres EXP ersetzt.

EXP-001 bis EXP-017 haben **kein Einzeldokument** (sie wurden vor der
Doc-Aufspaltung nur als Index-Zeilen gefuehrt); ihr Status stammt aus der
`EXP-INDEX.md`-Umsetzungsstand-Sektion plus Code-Stichprobe und wird auf
Feature-Granularitaet gefuehrt (keine einzeln nummerierten Tasks). EXP-018
aufwaerts haben Einzeldokumente und wurden Task-fuer-Task geprueft.

---

## 1. Gesamttabelle

| EXP | Titel | Tasks gesamt | Umgesetzt | Offen | Status |
|-----|-------|-------------|-----------|-------|--------|
| 001 | Matching- und Picture-Choice-Uebungen | — (Feature) | ja | — | DONE |
| 002 | Content-Repository | — (Feature) | ja | — | DONE |
| 003 | Lektionsformat | — (Feature) | ja | — | DONE |
| 004 | GitHub-Organisation | — (Feature) | nein | alles | DEFERRED |
| 005 | Offline-Modus und Domaenen | — (Feature) | ja | — | DONE |
| 006 | Freitext und Word Tiles | — (Feature) | ja | — | DONE |
| 007 | Fehlergranulare Wiederholung | — (Feature) | ja | — | DONE |
| 008 | Lob und Celebration | — (Feature) | ja | — | DONE |
| 009 | Soziale Features (Phase 2) | — (Feature) | nein | alles | DEFERRED |
| 010 | Missionen und Plaketten | — (Feature) | ja | — | DONE |
| 011 | Ranglisten und Turniere | — (Feature) | nein | alles | DEFERRED |
| 012 | Turnier-Library und soziale Erweiterungen | — (Feature) | nein | alles | DEFERRED |
| 013 | Fehler-basierte adaptive Lektionen | 3 Stufen | 2 (regelbasiert) | Stufe 3 (KI-augmentiert) | PARTIAL |
| 014 | Community-Feedback und App-Lernen | — (Feature) | teilw. (Community-Sharing) | KI-Lernschleife | PARTIAL |
| 015 | Kinder-Variante | — (Vision) | nein | alles | DEFERRED |
| 016 | Test-Strategie (automatisiert) | — (laufend) | ja (laufend) | — | DONE |
| 017 | Manuelle Tests | — (laufend) | ja (laufend) | — | DONE |
| 018 | Uebungsrichtung — Rezeptiv vs. Produktiv | 4 Stufen | 4 | 0 | DONE |
| 020 | Lektions-Flusssteuerung (Pruefen/Weiter) | 2 Stufen | 2 | 0 | DONE |
| 021 | Lektions-Creator (eigenstaendig) | 4 (MVP) + Folge-Ausbau | 4 (MVP) | Folge-Ausbau | PARTIAL |
| 022 | Visueller Lernpfad (xyflow) | 4 Use Cases | 1 (UC1) + UC3-Teil | UC2, UC4 | PARTIAL |
| 023 | Multi-Content-Repository | 3 Phasen (A/B/C) | A + B + C-slice | C-Rest (Backend) | PARTIAL |
| 024 | Strikte Schichtentrennung (Layer-Audit) | Phase 1/2/3 (+4) | Phase 1 + Fundament | Phase 2 (Plugins), 3 (Frontend U1), 4 | PARTIAL |
| 025 | Author-provided Lesson Sets (Buch-Begleiter) | 9 (AUTH-01..09) | 2 (AUTH-01, AUTH-02) | 7 | PARTIAL |
| 026 | User-Lektionen im Content-Baum | 7 (UGC-01..07) | 7 | 0 | DONE |
| 027 | Internationalisierungs-Strategie | 12 (I18N-01..12) | 4 | 8 | PARTIAL |
| 028 | User-Event-Recording | 5 (EVT-01..05) | 5 | 0 | DONE |
| 029 | Medien-Ressourcen (Gegenseitigkeit) | 8 (MED-01..07, MED-10) | 7 | 1 | DONE |
| 030 | Multi-User-Strategie | 7 (MU-01..05, MU-10, MU-20) | 0 | 7 | DEFERRED |
| 031 | ZIP-Backup-Format (.alb) | 6 (BAK-01..06) | 0 | 6 | OPEN |
| 032 | Inhaltliche Content-Validierung | 5 (CQV-01..05) | 0 | 5 | OPEN |
| 033 | KI-gestuetzte Content-Validierung | 12 (AIV-01..12) | 9 | 3 | PARTIAL |

**Verteilung:** DONE 15 · PARTIAL 9 · OPEN 2 · DEFERRED 6 · SUPERSEDED 0 (= 32).

> **Aktualisiert 2026-06-17 (nach den EXP-029/033-Feature-Merges).** Der
> erste Audit-Durchlauf fand EXP-029 und EXP-033 als reine Design-Dokumente
> (0 % umgesetzt). Parallel/danach landeten die Feature-PRs #674/#676/#678/
> #680/#684/#685/#686/#687/#688/#690/#691 auf `develop` — EXP-029 ist nun
> DONE (MED-10 offen), EXP-033 PARTIAL (AIV-06/07/12 offen). Tabelle + Detail
> unten entsprechend nachgezogen.

---

## 2. Offene Tasks (PARTIAL und OPEN)

### EXP-013 — PARTIAL (Stufe 3 offen)
Regelbasierte adaptive Lektionen sind ausgeliefert (Phase 53,
`frontend/src/lib/adaptive/`). Offen:
- **Stufe 3 (KI-augmentierte Generierung)** — bewusst zurueckgestellt
  (in CLAUDE.md als deferred vermerkt, P-150..P-152). Die regelbasierte
  Pipeline genuegt fuer das Kernversprechen.

### EXP-014 — PARTIAL
Community-Sharing (PR-Pipeline) deckt einen Teil ab. Offen:
- Die **KI-gestuetzte App-Lernschleife aus Community-Feedback** ist nicht
  gebaut; braucht Cloud-Backend + Nutzerbasis (haengt an EXP-004/009).

### EXP-021 — PARTIAL (Folge-Ausbau offen)
MVP vollstaendig: `/create-lesson`, 4-Schritt-Wizard
(`CreateLesson.tsx` + `create-lesson/*`), `exercise-generator.ts`,
`csv-cards.ts` (Einfuegen), dnd-kit, `saveUserSet` + Share-Wizard-Uebergabe,
`lesson-templates.ts`. Offen (im Doc explizit als "Folge-Ausbau"):
- Manueller Einzel-Uebungs-Editor (`ExerciseGenerator.tsx` traegt den
  Kommentar, dass dies der EXP-021-Folge-Ausbau ist) — nicht gebaut.
- CSV-**Datei-Upload** (statt nur Einfuegen).
- Token-Rollen-UI und Bild-Upload fuer Picture-Choice.

### EXP-022 — PARTIAL (UC2, UC4 offen)
Das Doc definiert UC1 als MVP, UC2-4 als Folgeausbauten. Umgesetzt:
- **UC1** Learning-Path-Graph (`LearningPathGraph.tsx` + `@xyflow/react` +
  `dagre`, `LessonNode`/`SetGroupNode`).
- **UC3 (teilweise)** Fehler-Cluster als In-Graph-Overlay
  (`learning-path-clusters-toggle`, `error-clusters.ts`), nicht als
  eigenstaendiger Cluster-Graph.

Offen:
- **UC2** Content-Browser-Baum als zoombarer Graph — `Content.tsx` ist
  weiter Liste/Baum, kein xyflow.
- **UC4** Beziehungs-Editor im Lektions-Creator — haengt am offenen
  EXP-021-Editor.

### EXP-023 — PARTIAL (Phase-C-Rest, Backend-gated)
Phase A (#118), B (#122) und der C-Slice (#124) sind ausgeliefert
(`content-repos.ts`, `recommended-repos.json`, `repo-rating.ts`,
`repo-token.ts`). Offen (alle brauchen ein geteiltes Backend, daher
DEFERRED innerhalb des PARTIAL):
- Community-Sterne-Aggregation, Trust 2 (community-verified), zentraler
  Index-Server, Coach-Fortschritts-Aggregation, Einmal-Invite-Tokens.

### EXP-024 — PARTIAL (Phase 2/3/4 offen)
Phase 1 (13 Request-Service-DB-Services auf Repository-Pattern migriert) +
Fundament (`backend/app/repositories/`, `deps.py`) + `architecture.md`-Regel
ausgeliefert. Offen:
- **Phase 2** Plugin-Service-Module — Plugins nutzen weiter `Session`
  direkt; `gamification/dashboard_repository.py` dokumentiert die
  Nicht-Migration explizit.
- **Phase 3** Frontend-U1 (~28 Dateien) — Migrationsplan-Checkboxen im Doc
  unmarkiert.
- **Phase 4** MINOR-Cleanup (S2-Guards, S3-Pragma) — offen.

### EXP-025 — PARTIAL (AUTH-03..09 offen)
Umgesetzt: **AUTH-01** (#529, `validate_book` mit `book`-Block +
Affiliate-Check), **AUTH-02** (#531, Content-Browser Buch-Begleiter-
Rendering). Offen:
- **AUTH-03** Trust-3-Begleit-Repo in `recommended-repos.json` (nur das
  offizielle Repo ist eingetragen).
- **AUTH-04** bidirektionaler `companion_repo`-Querverweis (books.yaml
  hat keinen `companion`-Block).
- **AUTH-05** Versions-/Update-Handling + ID-Stabilitaet/Remap.
- **AUTH-06** Konflikt-Policy fuer lokal editierte Author-Sets
  (Fork-statt-Mutation) — auch von EXP-026 vorausgesetzt, Produzent fehlt.
- **AUTH-07** Add-Flow Deeplink+QR mit buch-spezifischem Onboarding-Text.
- **AUTH-08** Autoren-/Verlags-Leitfaden (der neue `CONTENT-REPO-GUIDE.md`
  deckt den `book`-Block-Vertrag nicht als AUTH-Task ab).
- **AUTH-09** verifizierter Autor/Verlag — im Doc als DEFERRED markiert.

### EXP-027 — PARTIAL (8 von 12 offen)
Umgesetzt: **I18N-02** (Sprachauswahl-Skalierung, `SCRIPT_ORDER` in
`languages.ts`), **I18N-03** (Hindi-UI `hi.yaml`, in `UI_LANGUAGES` mit
`script: "devanagari"`), **I18N-11** (Hindi-Starter-Content `sets/hi/en-a1/`),
**I18N-08** teilweise (AI-Draft/Review-Konvention). Offen:
- **I18N-01** RTL-Infrastruktur, **I18N-04** Arabisch-UI, **I18N-05**
  Koreanisch-UI+Hangul, **I18N-06** Indonesisch-UI, **I18N-07**
  Italienisch-UI, **I18N-08** formale QA-Pipeline, **I18N-09**
  Content-Sprachpaar-Expansion (allgemein), **I18N-10** Exercise-RTL-Audit,
  **I18N-12** Arabisch-Content.

> Hinweis: die Task-Nummerierung in EXP-027 (I18N-05 = Koreanisch) weicht
> vom Commit-Tag des Hindi-Catalogs (`I18N-05` im `hi.yaml`-Header) ab. Im
> Doc ist I18N-03 = Hindi; der Catalog-Header nutzt I18N-05 als Commit-Label.
> Inhaltlich umgesetzt ist Hindi-UI (= I18N-03 im Doc).

### EXP-029 — DONE (7 von 8; MED-10 offen)
Nach dem ersten Audit-Durchlauf implementiert: `media.yaml`-Parser + Loader
mit Reziprozitaets-Gate (**MED-01/02**, #678), Lektions-Medien-Sektion
("Vertiefe das Thema") + `ResourceCard` (**MED-03/05**, #680), Medien-
Verfuegbarkeits-Badges auf Set-Zeilen + Gratis/Kurs-Badge (**MED-04**, #684),
offline-faehige YouTube-Thumbnails + i18n-Medien-Labels (**MED-06/07**,
#685/#688). Offen: **MED-10** (Partner-Onboarding-Doku — Business-
Development-Artefakt, kein Code; der eigentliche Engpass ist die
Partnergewinnung).

### EXP-030 — DEFERRED (0 von 7, gestuft)
Nichts ueber den Single-User-Baseline hinaus (`learnerState.ts`,
`NavAvatar.tsx`, `findMostRecent`). Offen: **MU-01** (`users.list()`),
**MU-02** (Profil-Umschalter-UI), **MU-03** (Isolations-Audit), **MU-04**
(aktives Profil als learnerState-Zeiger ohne Reload), **MU-05** (lokaler
PIN), **MU-10** (Sync-Identitaet pro Profil), **MU-20** (Cloud-Konten =
EXP-009/Phase 4, per Design deferred).

### EXP-031 — OPEN (0 von 6, Design-Dokument)
Backup ist weiter ein einzelner JSON-Dump (`createDexieBackup` /
`backup_export.py`); kein `.alb`/ZIP-Container. Offen: **BAK-01** (JSZip
vs fflate), **BAK-02** (`.alb`-Export), **BAK-03** (`.alb`-Import +
Magic-Byte + Legacy-Fallback), **BAK-04** (Avatar als Asset statt Base64),
**BAK-05** (BACKUP-AKZEPTANZTEST auf `.alb`), **BAK-06** (selektiver
`.alb`-Export). Doc committed heute (#644).

### EXP-032 — OPEN (0 von 5, Design-Dokument)
Die bestehende Validierung (`validate_content.py`, `content-validator.ts`)
ist rein strukturell. Offen: **CQV-01** (Encoding-/Antwortlaengen-Checks),
**CQV-02** (Sprachpaar-Konsistenz + Set-/Repo-Duplikat), **CQV-03**
(Akzent-/Artikel-Woerterbuecher), **CQV-04** (Batch-LLM-Review mit
Confidence-Report), **CQV-05** (Fehler-Melden-Button → Content-Repo-Issue).
Doc committed heute (#658).

### EXP-033 — PARTIAL (9 von 12; AIV-06/07/12 offen)
Nach dem ersten Audit-Durchlauf implementiert: set-weiter Batch-Prompt +
JSON-Parser (**AIV-01**, #674/#676), Report-UI + "Mit KI pruefen"-Button +
Kosten-Bestaetigung (**AIV-02/03/05**), Ergebnis-Caching in Dexie +
Markdown-Export (**AIV-04**, #686/#687), Content-Hash + Signatur-Objekt +
Client-Verifikation + "AI-Checked"-Badge (**AIV-08/09/10/11**, #690/#691).
Offen: **AIV-06** (CI-Action `ai_review.py` im Content-Repo), **AIV-07**
(Auto-Fix, nur User-Content), **AIV-12** (Signatur bei Content-Aenderung
invalidieren).

---

## 3. Beobachtungen

- **`EXP-INDEX.md`-Umsetzungsstand war stellenweise veraltet.** Stand-Marker
  `v1.79.0` (aktuell v1.85.0). EXP-028 ist inzwischen **vollstaendig** (alle
  EVT-01..05, #566), nicht "teilweise"; EXP-027 hat **4 Tasks** umgesetzt
  (Hindi-UI + Picker-Skalierung + Hindi-Content), nicht "reine Vision". Die
  Index-Sektion wurde im selben PR aktualisiert.
- **Keine EXP-Task-IDs in GitHub-Issues.** `gh issue list`-Suchen nach
  MED-/MU-/BAK-/CQV-/AIV-/AUTH-IDs liefern nichts; der Status ruht auf
  Code-/Git-Evidenz. Sub-Issues nutzen App-Issue-Nummern (#118, #519, ...),
  nicht die EXP-internen IDs.
- **Drei neue Design-Dokumente heute gelandet (EXP-031/032/033).** EXP-031
  (.alb-Backup) und EXP-032 (deterministische Validierung) sind weiter reine
  Vorhaben (0 %). EXP-033 dagegen wurde unmittelbar umgesetzt: 9 von 12 AIV
  shipped (#674/#676/#686/#687/#690/#691), nur AIV-06/07/12 offen — vom
  Design-Dokument zur PARTIAL-Implementierung am selben Tag.
- **Audit-Momentaufnahme vs. parallele Feature-Arbeit.** EXP-029 und EXP-033
  kippten WAEHREND dieser Audit-Runde von OPEN/DEFERRED auf DONE/PARTIAL,
  weil die Feature-PRs (#678..#691) parallel mergten. Lehre: ein Status-Audit
  ist eine Momentaufnahme; bei gleichzeitig laufender Feature-Arbeit muss er
  am Ende gegen den frischen `develop`-Stand gegengeprueft werden.
- **PARTIAL-Schwerpunkt:** die verbleibenden "Backend-gated"-EXPs (023
  Phase-C, 024 Phase-2/3, 014, 030) warten alle auf dieselben Voraussetzungen:
  ein geteiltes Backend bzw. Multi-User (EXP-030) bzw. Plugin-Migration. Das
  sind keine vergessenen Tasks, sondern bewusst gestufte Abhaengigkeiten.

## 4. Fragen und Annahmen

- **EXP-019** existiert nicht (Index springt 018 → 020); kein Fehler, nur
  eine Luecke in der Nummernfolge.
- **EXP-001..017** ohne Einzeldokument auf Feature-Granularitaet bewertet;
  "Tasks gesamt" = "—", Status aus Index-Umsetzungsstand + Code-Stichprobe.
- **EXP-029** beim ersten Durchlauf als DEFERRED (0 Tasks) eingestuft; nach
  den Feature-Merges #678..#688 auf DONE korrigiert (MED-01..07 umgesetzt,
  MED-10 offen). Siehe die Aktualisierungs-Notiz unter §1.
- **EXP-016/017** (laufende Querschnitts-Strategien) als DONE gefuehrt im
  Sinne von "kontinuierlich erfuellt", nicht "abgeschlossen".
