# Bekannte Fallstricke und Patterns

Diese Regeln stammen aus der Bibliogon-Entwicklung und allgemeiner Erfahrung. Sie werden im Laufe des Projekts erweitert.

## PluginForge

### Plugin-Dualitaet
- Ein Plugin hat ZWEI Rollen: BasePlugin (Lifecycle) + @hookimpl (Hooks).
- PluginForge registriert die Instanz bei pluggy. pluggy findet @hookimpl-Methoden automatisch.
- NICHT vergessen: register_plugin() in main.py aufrufen.

### Manuelle vs. Entry Point Registrierung
- v0.1.0 nutzt register_plugin() (Plugins im gleichen Repo).
- Entry Points erst ab v0.3.0.
- Beides kann kombiniert werden.

### Config-Defaults
- Fehlende YAML-Config-Dateien sind kein Fehler. Plugin bekommt leeres dict.
- Immer mit .get() und Defaults arbeiten: `self.config.get("key", "default")`.

### Hook firstresult
- AI-Provider Hooks nutzen firstresult=True. Nur der erste registrierte Provider der antwortet gewinnt.
- Sicherstellen dass nur der aktive Provider registriert ist.

### Plugin Settings YAML lebt in backend/config/plugins/
- PluginForge liest Settings aus dem Backend-weiten config_dir, NICHT aus dem Plugin-Ordner selbst.
- Kanonischer Pfad: `backend/config/plugins/{plugin_slug}.yaml`
- Symptom bei falschem Pfad: Plugin laedt, aber self.config ist leer.

## AI-Provider

### API-Key-Sicherheit
- Keys NIEMALS im Klartext loggen oder ans Frontend senden.
- Fernet-Verschluesselung nutzen (cryptography Library).
- Schluessel aus Umgebungsvariable, NICHT hardcoded.

### Rate Limits
- Alle Provider haben Rate Limits. Fehler abfangen und sinnvoll melden.
- anthropic SDK wirft RateLimitError.
- openai SDK wirft RateLimitError.
- Retry-Logik NICHT selbst bauen, die SDKs haben eigene.

### Streaming
- Fuer v0.1.0 kein Streaming. Einfache Request/Response.
- Streaming erst wenn die Basis steht (v0.2.0+).

### Modell-Defaults
- anthropic: claude-sonnet-4-20250514
- openai: gpt-4o
- gemini: gemini-2.0-flash
- Defaults in Plugin-YAML, nicht hardcoded.

## Sessions und Prompts

### System-Prompt-Laenge
- Nicht zu lang. 200-400 Woerter Maximum fuer den System-Prompt.
- Kontext (Thema, Ziel, bisheriger Verlauf) dynamisch anhaengen.

### Zyklus-Steuerung
- Der Zyklus-Schritt ist ein Vorschlag, kein Zwang.
- Die KI kann flexibel zwischen Schritten wechseln wenn der Nutzer anders reagiert.
- cycle_step in der DB trackt wo die Session nominell steht.

### Methoden-Wechsel
- Empfehlung, kein Zwang. Nutzer entscheidet.
- Nicht nach jeder schlechten Session sofort wechseln. Threshold nutzen (3 Sessions).
- Wechsel-Grund immer dokumentieren (in MethodSwitch.reason).

## Frontend

### Charts (Recharts)
- ResponsiveContainer IMMER als Wrapper um Charts.
- Recharts funktioniert nicht mit SSR. Nur Client-side rendern.
- RadarChart braucht mindestens 3 Datenpunkte.

### i18n
- Einfaches Pattern ohne Framework (v0.1.0).
- Sprache aus User-Settings laden, nicht aus Browser-Locale.
- Fallback: Englisch wenn Key in gewaehlter Sprache fehlt.

### TypeScript 6
- TS 6 inkludiert nicht mehr automatisch alle @types/* Pakete. Jedes benoetigte @types-Paket muss explizit in tsconfig.json unter "types" gelistet werden.
- Wenn @types/node gebraucht wird (z.B. fuer Tests mit node:fs): devDependency hinzufuegen UND in tsconfig.json "types": ["node", "vite/client"] setzen.

### Vite 8 (Rolldown)
- Vite 8 nutzt intern Rolldown statt Rollup. manualChunks muss eine Funktion sein, kein Objekt.
- Bei Trailing-Slash-Matching in manualChunks: `id.includes('/node_modules/react/')` statt bare-Package-Matching, sonst kollidiert "react" mit "react-dom" und "react-router-dom".

### React 19
- useFormStatus, useOptimistic und verbessertes Suspense sind neu. Kein Breaking Change fuer unseren Use Case.
- React 19 Dev-Mode (Strict Mode) mounted Komponenten doppelt. In Tests `mockImplementation` statt `mockImplementationOnce` verwenden, sonst wird der Mock beim zweiten Mount konsumiert.

## Allgemeine Patterns

### Vor Custom-Implementierungen pruefen
- Immer zuerst checken ob eine Library das schon loest.

### End-to-End Behavior Tests, nicht "kwarg passes through" Tests
- Jedes Setting muss mindestens einen Test haben, der den nicht-Default-Wert setzt und eine BEOBACHTBARE Verhaltensaenderung asserted.
- Smoke-Tests die nur pruefen ob ein Dict korrekt gesetzt wurde, sind kein Ersatz fuer Behavior-Tests.

### Atomic Commits
- "Atomic Commit" bedeutet: jeder Commit ist die kleinste reversible Einheit die den Baum gruen laesst.
- Wenn ein Split einen kaputten Zwischenzustand erzeugt (z.B. Source-Aenderung loescht eine Funktion die bestehende Tests noch importieren), ist der Split falsch. Beides in einen Commit.

### CI vs. lokale Umgebung
- `poetry install` entfernt NICHT Dependencies die aus pyproject.toml verschwunden sind. In langlebigen lokalen venvs bleiben stale .dist-info Verzeichnisse. CI startet frisch und schlaegt sofort fehl.
- Mitigation: Regelmaessig `poetry install --sync` ausfuehren.

### Error-Handling Fehler die wir vermeiden
- HTTPException direkt aus Services werfen. Macht Services untestbar.
- Bare `except Exception: pass` in Plugin-Code. Fehler verschwinden.
- Frontend: API-Calls ohne catch. User klickt "Starten" und nichts passiert.
