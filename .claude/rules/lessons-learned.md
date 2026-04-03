# Bekannte Fallstricke und Patterns

Diese Regeln stammen aus der Bibliogon-Entwicklung und allgemeiner Erfahrung. Sie werden im Laufe des Projekts erweitert.

## PluginForge

### Plugin-Dualitaet
- Ein Plugin hat ZWEI Rollen: BasePlugin (Lifecycle) + @hookimpl (Hooks).
- PluginForge registriert die Instanz bei pluggy. pluggy findet @hookimpl-Methoden automatisch.
- NICHT vergessen: register_plugin() in main.py aufrufen.

### Manuelle vs. Entry Point Registrierung
- v0.1.0 nutzt register_plugin() (Plugins im gleichen Repo).
- Entry Points erst ab v0.3.0 wenn Plugins in eigene Pakete ausgelagert werden.
- Beides kann kombiniert werden.

### Config-Defaults
- Fehlende YAML-Config-Dateien sind kein Fehler. Plugin bekommt leeres dict.
- Immer mit .get() und Defaults arbeiten: `self.config.get("key", "default")`.

### Hook firstresult
- AI-Provider Hooks nutzen firstresult=True. Nur der erste registrierte Provider der antwortet gewinnt.
- Sicherstellen dass nur der aktive Provider registriert ist.

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

## Allgemeine Patterns

- Vor Custom-Implementierungen: Pruefen ob eine Library das schon loest.
- AI-Provider-Tests: IMMER mocken. Kein echter API-Call in Tests.
- Profil-Berechnung: Deterministisch. Gleiche Antworten = gleiches Profil.
- Methodenwechsel-Logik: Rein regelbasiert (kein ML). Threshold-basiert.
