# Adoptions-Evaluierung + Migrationsplan: assistant-ui für die Session-Chat-UI

> Architektur-Entscheidung. Stand: 2026-06-25. Tracking: #1126.
> Regel: [reusability.md](../../.claude/rules/reusability.md) Implementierungs-
> Hierarchie + [docs/VIBE-CODING-POLICY.md](../VIBE-CODING-POLICY.md) §7.
> Worked Example der Methodik: [2026-06-17-library-first-audit.md](2026-06-17-library-first-audit.md).
> **Status: Plan. Noch kein Code.** Umsetzung erst nach Freigabe + `npm audit`-Gate.

## 1. Entscheidung

Für die Chat-**Präsentation/-Runtime** wird `@assistant-ui/react` adoptiert
(Stufe 3 der Hierarchie). Der **Lern-Domänen-Kern** bleibt selbstgebaut
(Stufe 4, dokumentiert hier) — keine Library modelliert ihn. Es ist eine
**Hybrid**-Lösung, kein Voll-Rewrite und kein reines Weiterbasteln am alten
`SessionChat`.

## 2. Library-First angewandt (Stufe-3-Scorecard, verifiziert 2026-06-25)

| Kriterium | Wert | |
|---|---|---|
| Weekly downloads | 1.234.740 | ✅ (> 1000) |
| Letztes Release | v0.14.24, aktiv | ✅ (< 6 Monate) |
| Lizenz | MIT | ✅ (Projekt ist MIT) |
| React 19 | peerDeps `react ^18 \|\| ^19` | ✅ |
| Bestehende Deps bevorzugt | baut auf Radix (im Stack) + zustand/zod/react-textarea-autosize | ✅ |
| Keine CVEs | keine für das Paket; RSC-RCE betrifft Next/RSC, nicht unsere Vite-SPA | ⏳ `npm audit` beim Install |

Quellen: npm-Registry (`@assistant-ui/react`), npm-downloads-API, unpkg
`package.json@latest`, Socket/GitHub-Advisory/Snyk (keine Paket-CVEs).

## 3. Was adoptiert wird — und was bewusst nicht

### Stufe 3 (Library: assistant-ui) — Chat-Präsentation/-Runtime
- Thread-/Message-Primitives, Composer (inkl. **Enter-to-send** nativ),
  Streaming-Bubbles, Auto-Scroll, Scroll-to-bottom, a11y/Fokus-Management.

### Stufe 1 (Sprache) — Triviales
- Enter-to-send ist im assistant-ui-Composer nativ; kein eigener
  KeyboardEvent-Handler nötig.

### Stufe 4 (Selbstbau, dokumentiert) — Lern-Domäne, die keine Library modelliert
- **7-Schritt-Lernmodell** + **Step-Evaluator** (Confidence-Gate, cycle_step-Advance)
- **Dual-Storage** über `IStorageService` (Dexie mit browser-direkten AI-Calls /
  API) — inkl. des #1122-Kontext-Rebuilds
- **Method-Switch-Banner**, **XP/Gamification**, **Cycle-Progress**
- **i18n (11 Sprachen)**, **Design-Tokens** (6 Themes), **`data-testid`**-E2E-Fläche
- **Voice/Mic** (Web Speech), **Markdown-Rendering** (react-markdown + remark-gfm)

> Begründung Stufe 4 (Regel-Pflicht): Diese Concerns sind app-spezifische
> Orchestrierung; keine Chat-Library bildet sie ab. Gleiche Einstufung wie im
> Library-First-Audit vom 2026-06-17 für genuin domänenspezifischen Code.

## 4. Architektur: der Adapter-Seam

assistant-ui erlaubt eigene Backends über einen **`ChatModelAdapter`**
(bzw. `useExternalStoreRuntime` / `useLocalRuntime`). Genau dort wird unsere
bestehende Storage-Schicht eingehängt:

```
assistant-ui <Thread/> + <Composer/>
        │  (run/stream)
        ▼
ChatModelAdapter  ──►  getStorage().session.streamMessage / message
        │                       │
        │                       ├─ Dexie: browser-direkte AI-Calls (#1122-Rebuild)
        │                       └─ API:   FastAPI-Backend
        ▼
StepEvaluation / MethodSwitch / XP  ──►  als EIGENE Komponenten um den Thread gerendert
```

- Der Adapter ruft `getStorage().session.streamMessage(...)` auf und mappt die
  Deltas in den assistant-ui-Stream. **Beide Storage-Modi bleiben erhalten**,
  und der #1122-Fix (frischer importierter Kontext pro Turn) wirkt automatisch.
- Step-Eval-Ergebnis / Method-Switch / XP kommen wie heute aus dem
  `SendMessageResult` und werden als unsere eigenen Komponenten **um** den
  assistant-ui-Thread herum gerendert (assistant-ui rendert nur die Konversation).

## 5. Was die Migration nebenbei löst (die ursprünglichen 4 Punkte)

| Wunsch | Wie |
|---|---|
| Enter-to-send | assistant-ui-Composer (nativ) |
| Chatfenster leeren bei importierter Sitzung | Runtime-Init: leerer Thread statt alter Verlauf |
| KI beginnt mit nächster Lektionsfrage | Adapter feuert einen Eröffnungs-Turn beim Thread-Init |
| Importierter Chat + Lektion-Daten an die KI | bereits live via #1122 (Adapter ruft dieselbe Schicht) |

## 6. Migrationsphasen (jede Phase hält die Gates grün)

- **Phase 0 — Spike (hinter Feature-Flag):** Dep hinzufügen, `npm audit`,
  einen assistant-ui-`<Thread/>` mit minimalem `ChatModelAdapter` gegen
  `getStorage().session.*` rendern. Kein Cutover. Nachweis: Streaming läuft in
  Dexie-Mode ohne Backend.
- **Phase 1 — Domänen-Wiring:** Step-Evaluator-Ergebnis, Method-Switch-Banner,
  Cycle-Progress, XP um den Thread anbinden (unsere Komponenten).
- **Phase 2 — Parität:** i18n (11 Sprachen), Design-Tokens/Theming auf die
  assistant-ui-Slots, **`data-testid`-Parität** (E2E-Selektoren erhalten),
  Voice/Mic, Markdown.
- **Phase 3 — Importierte-Sitzung-UX:** leeren Thread + KI-Eröffnung mit der
  nächsten Lektionsfrage (die ursprünglichen Wünsche).
- **Phase 4 — Cutover + Aufräumen:** Flag entfernen, altes `SessionChat`
  löschen, `SessionChat.test.tsx` ersetzen, Visual-/Feature-Screenshots neu.

Backend-Hinweis: Der #1122-Rebuild existiert bisher nur in Dexie. Für
API-/Desktop-Modus ist das gleiche Rebuild-on-Resume im Backend (`routes.py`)
ein **separater** Folge-Schritt (eigene Aufgabe), unabhängig von dieser UI-Migration.

## 7. Risiken + Gates

- **Dual-Mode-Vertrag:** Jede Phase muss `make test-dexie-smoke` grün halten
  (GH-Pages-Build ohne Backend) — die Migration darf den Dexie-Pfad nie brechen.
- **Testid-Parität:** E2E nutzt `data-testid`; beim Umbau müssen die Selektoren
  (`chat-input`, `chat-send`, `chat-messages`, …) erhalten oder bewusst
  migriert + Specs angepasst werden.
- **Bundle:** assistant-ui + Deps zur Bundle-Bilanz prüfen (Perf-Audit-Stil);
  lazy-load wo sinnvoll.
- **Theming:** assistant-ui-Styles müssen über unsere CSS-Variablen/Tokens
  laufen (kein Hardcode; `no-hardcoded-colors`-Gate).
- **CVE-Gate:** `npm audit` nach dem Hinzufügen; Ergebnis im Phase-0-PR dokumentieren.

## 8. Alternative „Selbstbau behalten" — warum nicht (Regel-Pflicht)

Das alte `SessionChat` ist Stufe-4-Bestand (vor der shadcn-Ära). Die Hierarchie
greift „vor jeder **neuen** Utility": Da wir die Chat-UI ohnehin substanziell
anfassen (4 Wünsche + Folgearbeit), zählt das als neue Arbeit an der UI —
und da besteht die Library den Test. Reiner Weiterbau am Selbstbau wäre nur
für die **Domäne** gerechtfertigt (Abschnitt 3), nicht für die generische
Chat-Oberfläche.

## 9. Offene Entscheidung für den Owner

Diese UI-Strategie-Erweiterung (eine neue UI-Dependency) ist laut
[architecture.md](../../.claude/rules/architecture.md) eine Owner-Entscheidung.
Freigabe = Start von Phase 0.
