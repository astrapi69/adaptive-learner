# EXP-035: Vercel AI Elements Integration

> **Status:** Exploration (Vorschlag). Empfehlung: Option A (schrittweise),
> mit den unten in "Audit-Ergebnisse" revidierten Prioritaeten.
> **Kategorie:** Feature / Querschnitt (AI-UI). **Abhaengig von:** shadcn/ui
> (vorhanden), Session-Plugin (vorhanden).

## Idee

Die bestehende AI-Session UI (Chat, Feedback, Prompt-Eingabe) ist komplett custom gebaut.
Vercel AI Elements (https://github.com/vercel/ai-elements) bietet eine battle-tested
Komponentenbibliothek fuer AI-native UIs, basierend auf shadcn/ui. Da wir shadcn/ui
und Tailwind CSS Variables bereits nutzen, ist die Integration mit minimalem Friction moeglich.

Ziel: Custom AI-UI-Code durch AI Elements ersetzen (Library-First, Tier 3 statt Tier 4)
und gleichzeitig die AI-Lernerfahrung verbessern.

## Bestandsaufnahme: Was haben wir heute?

### AI-Session UI (custom)
- Chat-artiger Lernmodus mit AI-Provider (Anthropic/OpenAI/Gemini)
- Prompt-Templates (42-Zellen-Matrix: 6 Methoden x 7 Steps)
- Dual-Prompt-Architektur (Lern-Antwort + Step-Evaluation)
- Browser-Direct AI Calls (kein Backend-Proxy noetig)

### AI Content Validation (EXP-033)
- KI-basierte Kartenpruefung
- Ergebnis-Anzeige mit Trust-Badges

### Relevante bestehende Komponenten
- Session-Chat-Renderer (custom)
- Prompt-Input (custom)
- AI-Feedback-Anzeige (custom)
- Code-Anzeige in Lektionen (custom oder Markdown)

## AI Elements Komponenten-Mapping

| AI Elements | Ersetzt bei uns | Mehrwert |
|-------------|----------------|----------|
| `Conversation` + `ConversationContent` | Custom Session-Chat-Container | Scroll-Management, Streaming-Support, Accessibility |
| `Message` + `MessageContent` + `MessageResponse` | Custom Chat-Bubble-Renderer | Markdown-Rendering, Copy-Button, Retry, Streaming-Animation |
| `PromptInput` | Custom Eingabefeld | File-Attachments, Multi-Line, Submit-on-Enter, Stop-Button |
| `CodeBlock` | Custom Code-Anzeige / Markdown-Code | Syntax-Highlighting, Copy-Button, Language-Label |
| `Reasoning` + `ReasoningTrigger` | Nicht vorhanden | AI-Denkprozess anzeigen (EXP-033 Validation Reasoning) |
| `MessageAction` | Custom Feedback-Buttons | Standardisierte Aktionen (Copy, Retry, Rate) |

## Architektur-Optionen

### Option A: Schrittweise Migration (empfohlen)

Phase 1: Neue Features mit AI Elements bauen
- AI Content Validation Reasoning-Anzeige (Reasoning Component)
- Code-Anzeige in IT/Programmierung Lektionen (CodeBlock)
- Kein Umbau bestehender UI

Phase 2: Session-Chat auf AI Elements umstellen
- Conversation + Message ersetzen den Custom-Renderer
- PromptInput ersetzt das Custom-Eingabefeld
- Bestehende Prompt-Template-Logik bleibt (Backend-Logik, nicht UI)

Phase 3: Erweiterte Features (nur mit AI Elements sinnvoll)
- Streaming-Anzeige (Token fuer Token)
- AI Reasoning sichtbar machen
- Message-Editing (Frage umformulieren)
- File-Attachments (Bild/PDF als Kontext)

### Option B: Big-Bang Migration

Alles auf einmal umstellen. Hoehere Qualitaet am Ende,
aber grosser PR, laenger nicht mergebar, Regressionsrisiko.

### Option C: Nur fuer neue Features

AI Elements nur fuer neue Features nutzen, bestehende UI
nicht anfassen. Niedrigstes Risiko, aber Inkonsistenz
zwischen alter und neuer AI-UI.

### Empfehlung: Option A

Schrittweise, rueckwaertskompatibel, sofortiger Mehrwert
ab Phase 1. Jede Phase ist unabhaengig mergebar.

## Technische Herausforderungen

### TH-1: shadcn/ui Kompatibilitaet
AI Elements setzt shadcn/ui voraus. Pruefung noetig:
- Welche shadcn/ui Version nutzen wir?
- Stimmen die CSS Variable-Namen ueberein?
- Konflikte mit unserem Design-Token-System?

### TH-2: Vercel AI SDK Abhaengigkeit
AI Elements nutzt `@ai-sdk/react` (useChat Hook).
Wir haben eigene AI-Call-Logik (Browser-Direct, Multi-Provider).
Optionen:
- Adapter schreiben der unsere AI-Calls in useChat-Format bringt
- AI Elements Komponenten ohne useChat nutzen (nur UI-Layer)
- Vercel AI SDK als zusaetzlichen Provider-Layer einsetzen

### TH-3: i18n
AI Elements ist Englisch. Unsere App hat 11 UI-Sprachen.
- Labels/Aria-Texte muessen lokalisierbar sein
- Pruefen ob AI Elements Props fuer Custom-Labels bietet
- Falls nicht: Components forken oder wrappen

### TH-4: Multi-Theme
Wir haben 9+ Themes. AI Elements nutzt shadcn/ui CSS Variables.
- Muessen unsere Theme-Tokens auf shadcn/ui Naming gemappt werden?
- Oder ueberschreibt AI Elements eigene Tokens?

### TH-5: Bundle-Groesse
AI Elements wird als Source installiert (shadcn-Stil, kein NPM-Paket).
- Nur die Komponenten installieren die wir brauchen
- Tree-Shaking sollte funktionieren
- Messung: vorher/nachher Build-Groesse

### TH-6: Browser-Direct AI Calls
Vercel AI SDK erwartet typischerweise einen Server-Endpoint.
Unser Dexie-Modus macht Browser-Direct Calls.
- Adapter noetig der Browser-Direct als "Server" simuliert
- Oder: AI Elements nur als UI-Layer, eigene Call-Logik behalten

## Roadmap-Tasks

### Phase 1: Foundation + Quick Wins
- AIE-01: shadcn/ui Kompatibilitaets-Audit (TH-1, TH-4)
- AIE-02: AI Elements installieren (nur benoetigte Komponenten)
- AIE-03: CodeBlock in IT/Programmierung Lektionen einsetzen
- AIE-04: Reasoning-Anzeige fuer AI Content Validation (EXP-033)

### Phase 2: Session-Chat Migration
- AIE-05: Adapter fuer Browser-Direct AI Calls (TH-6)
- AIE-06: Conversation + Message ersetzen Custom-Renderer
- AIE-07: PromptInput ersetzen Custom-Eingabefeld
- AIE-08: MessageAction fuer Feedback-Buttons
- AIE-09: i18n-Wrapper fuer AI Elements Labels (TH-3)

### Phase 3: Neue Capabilities
- AIE-10: Streaming-Anzeige (Token-by-Token)
- AIE-11: Message-Editing (Frage umformulieren)
- AIE-12: AI Reasoning transparent machen
- AIE-13: File-Attachments als Lernkontext

## Offene Fragen

1. Welche Version von shadcn/ui nutzen wir aktuell?
   Ist sie kompatibel mit AI Elements?

2. Nutzt die AI-Session bereits Streaming, oder sind es
   vollstaendige Antworten? (bestimmt Prio von AIE-10)

3. Soll der Vercel AI SDK (`ai` Package) als Dependency
   aufgenommen werden, oder nur die UI-Komponenten?

4. Gibt es einen bestehenden AI-Chat-View den wir
   als Referenz fuer die Migration nehmen koennen?

5. Ist die 42-Zellen-Matrix (Prompt-Templates) rein
   Backend/Logik oder hat sie UI-Implikationen?

## Evaluation

| Kriterium | Bewertung |
|-----------|-----------|
| Library-First Konformitaet | Hoch (Tier 3 statt Tier 4) |
| Aufwand Phase 1 | Niedrig (2-3 Tasks, kein Umbau) |
| Aufwand Phase 2 | Mittel (Adapter + Migration) |
| Risiko | Niedrig bei Option A (schrittweise) |
| Mehrwert | Hoch (Streaming, Reasoning, A11y, Maintenance) |
| Bundle Impact | Gering (Source-Install, Tree-Shakeable) |
| Kompatibilitaet | Zu pruefen (TH-1, TH-4, TH-6) |

---

## Audit-Ergebnisse (gegen Code verifiziert, 2026-06-19)

Die offenen Fragen + die "zu pruefenden" TH wurden gegen den aktuellen
Code (Stand v1.88.0 / `develop`) beantwortet. Quelle jeweils in Klammern.

### Antworten auf die offenen Fragen

**F1 — shadcn/ui-Version + Kompatibilitaet (TH-1):**
**Kompatibel.** `frontend/components.json`: `style: "new-york"`,
`cssVariables: true`, `baseColor: "neutral"`, `iconLibrary: "lucide"`,
`css: "src/styles/tailwind.css"`, Aliase `@/components`, `@/components/ui`,
`@/lib/utils`, `@/hooks`. Stack: **Tailwind v4** (`@tailwindcss/vite` 4.3),
`class-variance-authority`, `clsx`, `tailwind-merge`, diverse `@radix-ui/*`.
Das ist exakt die Basis, die AI Elements (shadcn-Registry, new-york,
Tailwind v4, lucide) erwartet — die Registry-Installation (`npx ai-elements`
bzw. `shadcn add`) sollte ohne Anpassung greifen.

**F2 — Streaming bereits vorhanden?**
**Ja, schon implementiert.** Der Custom-Renderer
`frontend/src/components/SessionChat.tsx` hat seit v1.6.0 einen
`streaming`-State, SSE-Deltas und einen Trailing-Cursor (`▍`), und rendert
Markdown waehrend des Streams. Backend: der `ai_complete_stream`-Hook +
`/message/stream` existieren und sind in **allen drei** Provider-Plugins
(anthropic/openai/gemini) implementiert. **Folge:** AIE-10 ("Streaming
Token-by-Token") ist **kein neues Feature** — es waere nur eine
Re-Implementierung auf AI-Elements-Basis. Prioritaet runter.

**F3 — Vercel AI SDK als Dependency?**
Aktuell **nicht installiert** (kein `ai`, kein `@ai-sdk/react` in
`package.json`). **Empfehlung: NICHT aufnehmen.** AI Elements als reinen
**UI-Layer** verwenden (Komponenten ohne `useChat`), gespeist aus unserer
bestehenden Call-Logik. Das umgeht TH-2 und TH-6 vollstaendig und erhaelt
Multi-Provider + Browser-Direct + die Dual-Prompt-Architektur. Ein
`ai-sdk`-Transport-Adapter waere machbar, dupliziert aber unsere
funktionierende Aufruf-Schicht — nur sinnvoll, falls spaeter AI-SDK-only
Features (Tool-Calls, generative UI) konkret gebraucht werden.

**F4 — Bestehender AI-Chat-View als Referenz?**
Ja: `frontend/src/pages/Session.tsx` (Seite, ~629 Zeilen) +
`frontend/src/components/SessionChat.tsx` (Custom-Renderer mit
Streaming/Markdown/Bubbles). Das sind die Migrationsziele fuer AIE-06/07.

**F5 — 42-Zellen-Matrix Backend oder UI?**
**Rein Backend/Logik, null UI-Implikationen.** Sie lebt im Session-Plugin
(`plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`:
`METHODS`, `MIN_STEP`/`MAX_STEP`, `build_analysis_context`; konsumiert ueber
den `create_session_prompt`-Hook). Die Chat-UI-Migration ist davon
unabhaengig — die Templates bleiben unangetastet.

### Revidierte TH-Bewertung

- **TH-1 (shadcn-Kompat): geloest** — Standard-Setup, passt.
- **TH-4 (Multi-Theme): weitgehend geloest.** Die `@theme inline`-Bruecke in
  `frontend/src/styles/tailwind.css` definiert bereits alle shadcn-Tokens,
  die AI Elements liest: `--color-background/foreground/muted/
  muted-foreground/border/primary/primary-foreground/secondary/accent/ring/
  card/popover/input/destructive`. Diese mappen auf unsere per-Theme-Tokens
  (`--accent`, `--bg-*`, `--fg-*` …), d.h. AI Elements **themed automatisch
  ueber alle 12 Themes**. **Caveat:** shadcn-`accent` ist semantisch eine
  *gedaempfte Hover-Flaeche*, in unserer Bruecke aber bewusst auf die
  **Marken**-Akzentfarbe gelegt (`--color-accent: var(--accent)`). AI-Elements-
  Hover-Flaechen wuerden dadurch markenfarbig getoent. Beim Einbau visuell
  pruefen; ggf. `--color-accent` auf einen Surface-Token remappen
  (Design-Token-Regel beachten — kein Hardcode).
- **TH-2 / TH-6 (AI SDK / Browser-Direct): umgehbar** — siehe F3
  (Pure-UI-Layer, keine SDK-Dependency, kein Server-Transport-Adapter).
- **TH-3 (i18n): offen, real.** AI Elements liefert englische Default-Labels/
  Aria-Texte. Vor dem Einbau pruefen, welche Komponenten Label-Props bieten;
  wo nicht, ein duenner Wrapper mit `useI18n()` (Pattern wie `shared/`-
  Komponenten: Labels als Props mit EN-Defaults, App injiziert die 11
  Sprachen). Da AI Elements als **Source** installiert wird, ist Patchen/
  Wrappen unkompliziert.
- **TH-5 (Bundle): geringes Risiko, mit einer Ausnahme** — Source-Install,
  tree-shakeable. **Aber:** AI Elements `CodeBlock` bringt typischerweise
  einen eigenen Highlighter (Shiki) mit. Wir haben bereits einen **lazy,
  kuratierten** `highlight.js` (`frontend/src/components/content/CodeBlock.tsx`
  + `lib/content/hljs`). Zwei Highlighter = Bundle-Doppelung. Siehe AIE-03.

### Revidierte Task-Prioritaeten (Konsequenz des Audits)

- **AIE-04 (Reasoning-Anzeige): hoechster Phase-1-Wert** — echt neu (heute
  gibt es keine Reasoning-UI), passt zu EXP-033. Hier zuerst.
- **AIE-01 (Kompat-Audit): groesstenteils mit diesem Dokument erledigt** —
  bleibt als formaler Check beim Install (`shadcn add` Smoke + 12-Theme-
  Sichtpruefung + axe).
- **AIE-03 (CodeBlock): herabstufen / kritisch pruefen.** Wir haben bereits
  einen guten lazy CodeBlock (Copy + Language-Label + Output + kuratiertes
  hljs). AI-Elements-CodeBlock zu uebernehmen riskiert Bundle-Doppelung
  (zweiter Highlighter) fuer marginalen Mehrwert. Empfehlung: bestehenden
  CodeBlock behalten; AI-Elements-CodeBlock allenfalls *innerhalb* der
  Chat-Oberflaeche, falls dort gebraucht — nicht den Lektions-CodeBlock
  ersetzen.
- **AIE-10 (Streaming): herabstufen** — existiert bereits (F2). Nur als
  Refinement im Zuge von AIE-06 relevant, kein eigenstaendiges Feature.
- **AIE-05 (Browser-Direct-Adapter): vermeidbar** — entfaellt, solange wir
  AI Elements als Pure-UI-Layer nutzen (F3/TH-6).

### Empfehlung (revidiert)

Option A bleibt richtig, aber **Phase 1 fuehrt mit AIE-04 (Reasoning)** und
nutzt AI Elements durchgehend als **Pure-UI-Layer ohne Vercel AI SDK**.
AIE-03 (CodeBlock-Ersatz) und AIE-10 (Streaming) sind durch bereits
vorhandene, gute Loesungen entwertet und werden zurueckgestellt. Damit ist
der erste mergebare Schritt klein, netto-additiv und risikoarm.

## Fragen / Annahmen (Audit)

- **Annahme (konservativ):** AI Elements wird als Source via shadcn-Registry
  installiert (kein NPM-Runtime-Paket). Falls die Registry-CLI im
  Environment nicht erreichbar ist (vgl. die hand-authored shadcn-Button-
  Notiz in `components/ui/button.tsx`), werden die benoetigten Komponenten
  analog hand-portiert.
- **Offen (Produktentscheidung, nicht aus Code ableitbar):** Ob Phase 2/3
  ueberhaupt gewuenscht ist (Custom-SessionChat funktioniert inkl.
  Streaming), oder ob nur Phase 1 (AIE-04 Reasoning) umgesetzt wird. Diese
  Exploration empfiehlt, mit AIE-04 zu starten und nach dem ersten
  mergebaren Schritt neu zu entscheiden.
