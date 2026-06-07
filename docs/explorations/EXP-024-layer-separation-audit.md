# EXP-024: Strikte Schichtentrennung (Layer-Separation-Audit)

**Stand:** 2026-06-07
**Kategorie:** Querschnitt
**Status:** Audit abgeschlossen, Refactor entschieden, Migration begonnen
**Auslöser:** Vollständiges Codebase-Audit auf strikte Schichtentrennung mit
stabilen API-Verträgen zwischen den Schichten.

---

## Kontext

Die Architektur soll drei Schichten mit stabilen Verträgen besitzen, wobei
jede Schicht ausschließlich den Vertrag (API) der nächsten kennt, niemals
deren Implementierung:

1. **UI-Schicht (React):** Views, Pages, Panels. Spricht mit der Service-
   Schicht ausschließlich über einen typisierten API-Client. Keine Importe
   aus der Service-Implementierung, keine Geschäftslogik in Komponenten.
2. **Service-Schicht (FastAPI):** Geschäftslogik, Validierung, Orchestrierung.
   Spricht mit der Daten-Schicht ausschließlich über ein Repository-
   Interface. Kein direkter SQLAlchemy-/IndexedDB-/SQL-Zugriff.
3. **Daten-Schicht:** Persistenz-Implementierungen. Implementiert das
   Repository-Interface. Keine Geschäftslogik, keine HTTP-Konzepte.

---

## Audit-Methodik

Geprüft wurde gegen **zwei Referenzmodelle**, weil sie sich unterscheiden:

- **Generisches 3-Schichten-Modell (Audit-Auftrag):**
  UI -> typisierter API-Client -> Service -> **Repository** -> Daten.
- **Dokumentierte Projekt-Architektur** (`.claude/rules/architecture.md`):
  UI -> **`IStorageService`** (`getStorage()`) -> {`ApiStorage` -> REST |
  `DexieStorage` -> IndexedDB}; Backend = dünne Router -> Services ->
  **SQLAlchemy 2.0 direkt** (bewusst kein Repository-Pattern).

Bei Konflikt wird die Schwere am Projekt-Vertrag gewichtet (das ist die
durch ~5562 Tests + Dexie-Mode-Release-Gate erzwungene Realität).

---

## Schichten-Karte

| Schicht | Ort | Anmerkung |
|---|---|---|
| UI | `frontend/src/{pages,components,contexts,chat_import}` | React-Views |
| UI->Service-Vertrag (typisierter Client) | `frontend/src/api/client.ts` | REST-Client |
| UI->Service-Vertrag (Storage-Abstraktion) | `frontend/src/storage/` (`IStorageService`, `ApiStorage`, `DexieStorage`, 22 Namespaces) | *eigentliche* UI->Service-Naht |
| UI-Logik (rein) | `frontend/src/lib/`, `frontend/src/hooks/` | Berechnungen/Transforms, korrekt aus Komponenten ausgelagert |
| Service | `backend/app/routers/` (dünn) + `backend/app/services/` + `plugins/*/adaptive_learner_*/{routes,*}.py` | Geschäftslogik |
| Service-Verträge | `backend/app/schemas/`, `backend/app/hookspecs.py`, `backend/app/exceptions.py` | Pydantic + Hooks |
| Daten | `backend/app/models/` (SQLAlchemy), `backend/app/database.py`, `frontend/src/storage/db.ts` + `*-dexie.ts` | Persistenz |

**Keine Datei gehört zwei Schichten an.** Kein Frontend-File importiert
ausführbaren Backend-Code; alle `backend/...`-Vorkommen in `frontend/` sind
**Doc-Kommentare** ("Mirrors `backend/app/services/...`"), keine Importe.

---

## Befunde nach Typ

### UI -> Service

| # | Datei:Zeile | Befund | Schwere |
|---|---|---|---|
| U1 | `frontend/src/{pages,components}/*` (~28 Dateien) | Komponenten importieren den typisierten Client `api.*` direkt und umgehen `getStorage()`/`IStorageService` (Projekt-Regel: "API-Calls NUR über `getStorage()`"). | **MODERATE** |
| U2 | `frontend/src/lib/sse-reader.ts:55` | `fetch()` außerhalb des Clients — aber **SSE-Streaming-Transport** (der typisierte Client kann keinen Stream modellieren). Faktisch Teil der API-Client-Schicht. | **MINOR** |
| U3 | `frontend/src/lib/content/{content-repo-validate.ts:112, recommended-repos.ts:42}` | `fetch()` außerhalb des Clients — zielt aber auf **GitHub-Raw-URLs (externer Content)**, nicht auf den FastAPI-Service. Das ist die Daten-Quelle des Dexie-Modus, by design korrekt. | **MINOR / kein Problem** |

**Hinweis zu U1:** Im generischen Modell ist das *korrekt* (typisierter
Client = Vertrag). Im Projekt-Modell ist es ein Leck — und ein *gemischtes*:
~die Hälfte sind bewusste **API-only-Features** (`api.sync`, `api.identity`,
`api.github`, `api.notebooklm`) ohne Dexie-Pfad; die andere Hälfte
(`api.tracking`, `api.tools`, `api.session`, `api.assessment`, `api.projects`,
`api.users`) hat Dexie-Äquivalente und sollte über `getStorage()` laufen.
Keine Geschäftslogik leckt in Komponenten (Berechnungen liegen in `lib/`).

### Service -> Daten

| # | Datei:Zeile | Befund | Schwere |
|---|---|---|---|
| S1 | `backend/app/routers/imports.py:148` | Route-Handler führte eine Geschäfts-Query direkt aus (`db.query(LearningSession).filter(...).order_by(...).first()`). Gehört in den Service. | **MODERATE** — *behoben* |
| S2 | `backend/app/routers/{sync.py:198,223, element_errors.py:37, imports.py:272}` | Router nutzen `db.get(Model, pk)` für Existenz-/Auth-Guards. Dünne PK-Primitive, teils in `_require_user`-Helpern. | **MINOR** |
| S3 | `backend/app/services/backup_service.py:609` | Roh-SQL `db.execute(text("PRAGMA defer_foreign_keys=ON"))`. SQLite-spezifisches Pragma für die Restore-Transaktion. | **MINOR** |
| S4 | `backend/app/services/*` (16/29 Dateien) + Plugin-Module | **Kein Repository-Interface** — Services nutzen `Session` direkt. CRITICAL im generischen Modell; **bewusstes, dokumentiertes Design** im Projekt-Modell. | **siehe Entscheidungen** |

`element_errors.py:127` (`db.commit()` im Router) ist **kein** Verstoß — der
Docstring von `record_attempts` delegiert die Transaktionsgrenze explizit an
den Aufrufer (verifiziert durch Lesen).

### Daten -> Service

**Keine.** Kein `HTTPException`, keine Status-Codes, kein `fastapi`, keine
Geschäfts-`if/else` in `backend/app/models/`. Plugins: **0** `HTTPException`
in Routes oder Service-Modulen. Die Daten-Schicht ist sauber.

### Fehlende Abstraktionen

- Typisierter API-Client: **vorhanden** (`api/client.ts`).
- Storage-Abstraktion: **vorhanden, stärker als gefordert** (`IStorageService`
  erlaubt den Tausch des *gesamten Backends* gegen IndexedDB).
- UI-Framework tauschbar ohne Service-Änderung: **ja** (REST-Grenze).
- **Repository-Interface (SQLite -> Postgres ohne Service-Änderung):
  fehlt.** Services sind an SQLAlchemy gekoppelt.

---

## Schwere-Verteilung

- **CRITICAL:** keine (im Projekt-Modell). Im generischen Modell: S4.
- **MODERATE:** U1, S1.
- **MINOR:** S2, S3, U2, U3.

---

## Getroffene Entscheidungen (2026-06-07)

Der Audit wurde dem Nutzer mit der Empfehlung vorgelegt, S4 und U1
**so zu belassen** (dokumentiertes Design bzw. teils gewolltes Verhalten;
ein Repository-Layer wäre ein Rewrite getesteten, funktionierenden Codes
für eine Postgres-Tausch-Fähigkeit, die das SQLite-/Offline-first-Projekt
nicht braucht). Der Nutzer hat **explizit anders entschieden**:

### Entscheidung 1 — S4: Vollständiger Repository-Refactor

> Gewählt: **"Full repository refactor"** (alle 16 Services + Plugin-Module).

- Es wird ein **Repository-Interface** (ABC/Protocol) eingeführt, das die
  Service-Schicht importiert und die Daten-Schicht implementiert.
- Alle Services migrieren von `db: Session`-Parametern auf injizierte
  Repository-Instanzen; die Daten-Primitive (`query`/`add`/`delete`/`commit`)
  wandern in SQLAlchemy-Implementierungen.
- Geschäftsfehler (`NotFoundError`/`ConflictError`/`ValidationError`) und
  Ownership-Regeln bleiben/wandern in die Service-Schicht; Repositories
  geben `None` zurück statt zu werfen.
- DI-Verdrahtung in den Routern: `Depends(get_<x>_repo)` als Composition-Root
  (FastAPI-`Depends` bleibt aus dem `repositories/`-Paket heraus, damit die
  Daten-Schicht HTTP-frei bleibt; Provider liegen in einem `deps`-Modul).
- **Bewusste Abweichung von `architecture.md`** — die Regel-Datei wird im
  Zuge des Refactors angepasst (Repository-Pattern wird zum dokumentierten
  Standard). Diese Änderung ist ausdrücklich vom Nutzer autorisiert.

### Entscheidung 2 — U1: Alle Komponenten über `getStorage()`

> Gewählt: **"All of them"** (alle ~28 Dateien).

- Jede Komponente läuft über `getStorage()`/`IStorageService` statt `api.*`.
- Für die server-only-Features (sync/identity/github/notebooklm) erhält
  `DexieStorage` **"nicht verfügbar"-Stubs** mit freundlichem Fehler
  (konsistent mit der Regel "Dexie-mode is part of the contract: same-commit
  graceful degrade").

---

## Migrationsplan (Queue)

Inkrementell, **ein Commit pro logischer Einheit**, nach jedem Commit Suite
grün. Präfix: `refactor(architecture): ...`.

### Phase 0 — Fundament (zuerst, lt. Audit-Auftrag)
- [ ] `backend/app/repositories/base.py` — `Repository`-Basis (ABC).
- [ ] `backend/app/deps.py` — FastAPI-Repository-Provider (Composition-Root).

### Phase 1 — Backend-Services (16)
Reihenfolge nach Blast-Radius (klein zuerst), Pilot = `imports`:
- [ ] imports (Pilot, S1 bereits vorgezogen)
- [ ] projects, users, settings, identity, taxonomy, subjects
- [ ] curriculum, lesson_progress, element_errors, element_srs
- [ ] conversation_analysis, adaptive_lesson
- [ ] backup_service (inkl. S3-Pragma), sync_service, export_service,
      reset_service

### Phase 2 — Plugin-Service-Module (18 Module / 7 Plugins)
session (4), gamification (4), learning-repo (4), notebooklm (2),
tracking (2), anki (1), missions (1).

### Phase 3 — Frontend U1 (~28 Dateien)
- [ ] Dexie-Äquivalente verkabeln (tracking/tools/session/assessment/
      projects/users) — über `getStorage()`.
- [ ] server-only-Stubs in `DexieStorage` (sync/identity/github/notebooklm).
- [ ] Komponenten von `api.*` auf `getStorage()` umstellen.

### Phase 4 — Abschluss
- [ ] `architecture.md` auf Repository-Standard aktualisieren.
- [ ] MINOR-Aufräumung (S2 Guards, S3 Pragma-Kapselung) nach Abwägung.
- [ ] `make test` + `make test-dexie-smoke` grün.

---

## Bereits erledigt

- **S1 behoben** (Commit `a8624724`, Branch `refactor/layer-separation-audit`):
  `get_active_session_for_conversation` aus dem `imports`-Router in
  `imports_service` verschoben; toter `LearningSession`-Modellimport entfernt.
  Kein API-Vertrags-Wechsel. 34 imports-Router-Tests grün; Backend-Suite
  (1181 passed, 1 skipped) grün.
- **Phase 0 + Pilot `imports` erledigt:**
  - `app/repositories/{__init__,base}.py` — `Repository`-Basis (HTTP-freie
    Daten-Schicht-Vertraege).
  - `app/repositories/imports_repo.py` — `ImportsRepository` (ABC) +
    `SqlAlchemyImportsRepository` (alle Persistenz-Primitive des imports-
    Aggregats).
  - `app/deps.py` — Composition-Root mit `get_imports_repo` (einzige Stelle,
    die FastAPI + konkrete Impl kennt).
  - `imports`-Service migriert: `db: Session` -> `repo: ImportsRepository`;
    kein `Session`/`query`/`selectinload`/`db.add`/`db.commit` mehr im
    Service. Domain-Fehler bleiben im Service; Repo gibt `None` zurueck.
  - `imports`-Router auf `Depends(get_imports_repo)` umgestellt; der
    `db.get(User, ...)`-Guard in `analyze_import` laeuft jetzt ueber
    `repo.get_user`.
  - ruff + mypy sauber; 34 imports-Router-Tests grün.

---

## Risiken und offene Punkte

- **Umfang:** ~16 Services + 18 Plugin-Module + 28 Frontend-Dateien =>
  realistisch 40-80 Commits, mehrstündig. Nicht in einem Zug abschließbar;
  daher diese Exploration als verbindlicher Plan + Queue.
- **Cross-Aggregat-Queries:** Einige Services queren fremde Modelle (z. B.
  `imports` -> `LearningSession`). Pragmatik: pro-Service-Repository kapselt
  die *von diesem Service* genutzten Queries (keine puristischen Aggregat-
  Grenzen), um den Blast-Radius pro Commit klein zu halten.
- **Test-Blast-Radius:** 16 Backend-Testdateien importieren Service-Module
  direkt; Signaturwechsel `db`->`repo` zieht Test-Anpassungen nach sich
  (gleicher Commit wie die jeweilige Service-Migration).
- **HTTP-Freiheit der Daten-Schicht:** `repositories/` darf **kein** `fastapi`
  importieren; `Depends`-Provider leben in `deps.py`.
- **Dexie-Stubs vs. "keine toten Buttons":** server-only-Stubs müssen mit der
  SYNC-UI-GATE-Regel koexistieren (Feature nicht anbieten, wenn nicht
  verfügbar) — Stub wirft nur, falls trotz Gate aufgerufen.

---

## Abhängigkeiten

EXP-024 ist Querschnitt und berührt jede Feature-Schicht. Keine fachliche
Abhängigkeit, aber hohe Koordination mit dem Dexie-Mode-Release-Gate.
