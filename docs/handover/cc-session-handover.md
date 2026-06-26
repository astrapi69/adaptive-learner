# CC Session Handover

> Stand: 2026-06-25. Für die nächste Session. Zwei Aufgaben in Reihenfolge:
> **(1) Backend-Folgeschritt für importierte Chats**, danach **(2) Release v1.96.0**.

## Kontext: was seit v1.95.0 gelaufen ist

`develop` trägt 58 Commits seit v1.95.0 (Version noch `1.95.0`, Release nicht
getaggt). Schwerpunkt der letzten Sitzung: **importierte Lernchats** im
**Dexie-Mode** (GH-Pages/Preview) end-to-end repariert:

- #1078 Roh-Transkript als Kontext · #1122 Rebuild-on-Resume (kein eingefrorener
  Prompt) · #1137 kein „Inception-Drift" (Lernfortschritt #797 bei Import
  unterdrückt) · #1147 `session.get()`-DTO trug `imported_conversation_id` nicht
  (Wurzel-Bug für Header/Intro) · #1141 Header-Thema · #1143 leerer Start +
  Themen-Intro · #1133/#1148 API-Key-UX · #1131 Enter sendet · #1129 Session-Nav.
- assistant-ui: #1127 Plan + #1128 Phase-0-Spike (`?ui=assistant`), Umbrella
  **#1126** offen (Phasen 1-4).

**Wichtig:** Diese Fixes sind **Dexie-only** (`frontend/src/storage/ai/`,
`storage/dexie/`). Der **API-/Desktop-Modus läuft über das Backend** und hat
dieselben Bugs noch. Das ist Aufgabe 1.

Preview-Deploy: `adaptive-learner-content-test` ist der Preview-Host
(`.github/workflows/deploy-preview.yml`, `force_orphan` + `.git`-Filter im
Bundle, weil ein nested `.git` sonst einen Submodule-Gitlink erzeugt → GH-Pages
bricht). PWA-Service-Worker cached hartnäckig — beim Testen DevTools →
Application → SW „Update on reload" + Network „Disable cache".

---

## AUFGABE 1 — Backend-Folgeschritt: importierte Chats im API-Mode

Datei: `plugins/adaptive-learner-plugin-session/adaptive_learner_session/routes.py`
(+ ggf. `_context.py`/`prompts.py` desselben Plugins). Frontend-Referenz zum
Spiegeln: `frontend/src/storage/ai/session-flow.ts`
(`composeSystemPrompt`, `buildOutgoingHistory`).

### 1a. #1137-Pendant: #797 bei importierten Sessions überspringen
`start_session` (routes.py ~132-238) hängt aktuell den Lernfortschritt
(`_learning_context_for`, ~Zeile 216) **immer** an — auch bei importierten
Sessions. Das zieht „Currently working on: <Lektion>" in den Prompt und lässt
die KI zum aktiven Lektions-Thema abdriften statt beim importierten Chat zu
bleiben (Inception-Effekt).
- **Fix:** Genau wie #1137 (frontend) — wenn `imported_conversation_id` gesetzt
  ist, nur Analyse (`_analysis_context_for`) + Roh-Transkript
  (`_conversation_context_for`) anhängen und `_learning_context_for`
  **weglassen**; sonst (normale Session) nur `_learning_context_for`.

### 1b. #1122-Pendant: Rebuild-on-Resume (der größere Teil)
Resume gibt aktuell den eingefrorenen `system_prompt` zurück (routes.py
~141-163), und `append_message` / `append_message_stream` (~263 / ~326) bauen
die History aus den persistierten DB-Messages = der eingefrorenen System-Message.
Folge: spätere Kontext-Verbesserungen erreichen bestehende Sessions nie, und der
importierte Kontext wird nicht frisch aus der Konversation gezogen.
- **Fix (Lösung A, wie #1122):** Eine `compose_system_prompt(...)`-Hilfsfunktion
  extrahieren (build_prompt + language-directive + imported-block + learning-block,
  mit der 1a-Verzweigung). In `append_message` / `append_message_stream`: wenn die
  Session ein `imported_conversation_id` trägt, die ausgehende System-Message
  **frisch** aus der FK bauen (alte System-Message aus der ausgehenden History
  filtern), statt die persistierte zu replayen. Persistierung darf unverändert
  bleiben (die gespeicherte Kopie ist nur Seed) — der FROZEN-Persistenztest
  bleibt dann gültig.

### 1c. #1147-Pendant: Session-GET muss `imported_conversation_id` liefern
Prüfen, ob das Backend-Session-DTO (Pydantic-Schema + `GET .../session/{id}`)
`imported_conversation_id` enthält — sonst greifen Header-Thema (#1141) + Intro
(#1143) im **API-Mode** nicht, weil `ApiStorage.session.get()` das Feld vom
Backend bezieht. Falls es fehlt: ins Response-Schema aufnehmen.

### Nicht nötig im Backend
- **#1133 (API-Key-Gate)**: Im API-Mode ist das Feature-Gate ohnehin permissiv
  (`mode === "api" || hasAiKey`), die Analyse läuft serverseitig über den
  3-Schichten-Key. Kein Backend-Change.

### Gates für Aufgabe 1
- `make test` grün (backend + plugins + vitest). Neue pytest-Tests im
  session-Plugin: (i) importierte Session injiziert #797 NICHT, normale schon;
  (ii) eine importierte Session sendet beim 2. Turn frischen Kontext (mutierte
  Analyse erreicht den AI-Call); (iii) Session-GET enthält die FK.
- Issue-Pflicht: ein GitHub-Issue für „Backend: imported-session context parity
  (rebuild-on-resume + #797 suppression)" anlegen, `Closes #NN` im Commit.
- Branch `fix/...` von `develop`, PR gegen `develop`.

---

## AUFGABE 2 — Release v1.96.0 (nach Aufgabe 1)

Reihenfolge laut `.claude/rules/release-workflow.md` (Gitflow):
1. **Vorher:** die 3 offenen Dependabot-PRs prüfen + mergen (oder bewusst
   verschieben): #1150 (stylelint), #1151 (@types/node 26 — Major, ggf. tsconfig
   `lib` prüfen), #1152 (backend-minor-patch).
2. `make release-prepare VERSION=1.96.0` (Branch `release/1.96.0` von develop).
3. Auf dem Branch: `backend/pyproject.toml` Version bumpen → `make sync-versions`
   → `make sync-versions-check` + `scripts/verify_version_pins.sh 1.96.0`.
4. Changelog `changelog/releases/v1.96.0.md` aus den Commits (gruppiert, siehe
   Rohmaterial unten).
5. `make release-test` (MANDATORY: `make test`, `tsc --noEmit`, vitest, smoke,
   **`make test-dexie-smoke`**, ruff+mypy, pre-commit --all-files,
   `make verify-docs-discipline`).
6. `make release-finish VERSION=1.96.0` (merge → main + Tag, zurück nach develop).
7. `make release-publish VERSION=1.96.0` (GitHub Release).
8. Post-release: Journal-Eintrag, ROADMAP/CLAUDE.md, CLAUDE.md-Versions-/
   Current-State-Block aktualisieren.

### Changelog-Rohmaterial (Highlights seit v1.95.0)
- **Importierte Chats (Dexie):** #1078/#1122/#1137/#1141/#1143/#1147 + #1133/#1148
  (API-Key-UX) + #1131 (Enter) + #1129 (Session-Nav) + [Aufgabe-1-Backend-Parität].
- **assistant-ui:** #1127 Plan + #1128 Phase-0-Spike (`?ui=assistant`).
- **Lektionen:** #1013 Reverse-Mode, #1015 Endless-Mode, #1007/#1071/#1073,
  #1047 Komplexitäts-Burn-down.
- **Content:** #1094 Invitation-Codes, #1099 Online→Lokal-Migration.
- **Launcher:** docker-app-launcher 0.2.0 → 0.12.1 (run-in-background, Tray-Icon,
  konfigurierbare Ports).
- **CI/Deploy:** #1135/#1139/#1140/#1146 (Preview-Deploy auf content-test),
  #1108 SEO.

---

## Referenzen
- Frontend-Implementierung zum Spiegeln: `frontend/src/storage/ai/session-flow.ts`
  (`composeSystemPrompt`, `buildOutgoingHistory`), `storage/dexie/dexie-session.ts`
  (`get()` mit FK).
- Tests als Vorlage: `frontend/src/storage/ai/session-flow.test.ts`
  („imported-session topic focus", „REBUILD-ON-RESUME", „session.get returns
  imported_conversation_id").
- assistant-ui-Migrationsplan: `docs/audits/2026-06-25-assistant-ui-adoption.md`.
- Offene Issues: #1126 (assistant-ui Phasen 1-4).
