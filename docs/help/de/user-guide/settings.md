# Einstellungen

Die Einstellungen-Seite ist bewusst kurz. Fünf Abschnitte:

1. **Sprache** — UI-Sprache (DE / EN / ES / FR / EL / PT /
   TR / JA). Wechselt jeden String beim nächsten Rendern.
2. **KI-Anbieter** — wer deine Nachrichten sieht (Anthropic
   / OpenAI / Gemini). Live-Wechsel; die nächste Nachricht
   nutzt den neuen Anbieter.
3. **Modell-Überschreibungen** — Modellwahl pro Anbieter.
   Leer = Standard des Plugins. Datalist-Hinweise schlagen
   gängige Optionen vor.
4. **API-Keys** — einer pro Anbieter. Im Server-Modus
   verschlüsselt gespeichert (Fernet), im Lokal-Modus
   Klartext in IndexedDB. Das Frontend sieht nur ein
   `has_<provider>_key: bool`-Flag pro Anbieter.
5. **Speicher-Modus** *(v0.7.0+)* — Server vs Lokal.

## Sprache

Das Dropdown schreibt via `PATCH /api/settings/{user_id}`
sowohl `User.language` als auch `UserSettings.language` in
einer Transaktion. Der i18n-Provider im Frontend lädt die
Strings neu, der Wechsel ist sofort. Über `localStorage`
über Reloads hinweg persistiert.

Fünf Sprachen sind nativ. PT / TR / JA sind aktuell
englischer Durchgriff mit Platzhalter-Text — Übersetzungen
kommen, wenn Muttersprachler beitragen.

## KI-Anbieter

Das Dropdown schreibt `active_provider` in UserSettings. Die
nächste Nachricht löst `ai_complete` gegen das Plugin des
neuen Anbieters (Server-Modus) oder den HTTP-Client des
neuen Anbieters (Lokal-Modus) aus. Das Active-Badge in den
API-Keys folgt dem Dropdown.

## Modell-Überschreibung

Jeder Anbieter hat ein Standardmodell aus der billig-und-
schnell-Ebene (z.B. `claude-3-5-haiku-latest`, `gpt-4o-mini`,
`gemini-2.0-flash`). Mit der Überschreibung kannst du pro
Anbieter ein anderes Modell wählen — deine `claude-sonnet-4`-
Aufrufe gehen, wenn du Anthropics Überschreibung setzt.

Leer = Standard nutzen. Eine an das Feld geklemmte Datalist
schlägt gängige Optionen vor (z.B.
`claude-3-5-sonnet-latest`, `claude-haiku-4-5-20251001`).

## API-Keys

Jeder Anbieter hat eine eigene Zeile: Eingabe für den
Schlüssel, "Schlüssel speichern", "Schlüssel löschen". Die
Zeile des aktiven Anbieters trägt ein "Aktiv"-Badge, damit
du nicht den Überblick verlierst, welcher Schlüssel die
nächste Session bedient.

Schlüssel verlassen dein Gerät nie im Klartext:

- **Server-Modus**: Das Backend verschlüsselt mit Fernet
  (`ADAPTIVE_LEARNER_SECRET_KEY`) vor dem Persistieren. Die
  Entschlüsselung passiert nur serverseitig beim KI-Aufruf.
- **Lokal-Modus**: Der Schlüssel liegt in IndexedDB auf
  deinem Gerät, kein Server-Roundtrip. Akzeptables
  Bedrohungsmodell, weil die Daten den Browser nie
  verlassen; der KI-Anbieter IST der einzige Netzwerk-
  Endpunkt, der den Schlüssel sieht.

## Speicher-Modus {#speicher-modus}

Der v0.7.0-Schalter zwischen **Server** und **Lokal
(Browser)**:

- **Server** — jeder Lese- und Schreibzugriff trifft das
  FastAPI-Backend. Braucht ein laufendes Backend. Am besten
  wenn du dieselben Daten von mehreren Geräten nutzen willst
  (Sync ist serverseitig).
- **Lokal (Browser)** — jeder Lese- und Schreibzugriff
  trifft IndexedDB in diesem Browser. KI-Aufrufe gehen
  direkt zum Anbieter. Kein Backend nötig. Am besten für
  ein privates, gerätelokales Setup ohne Infrastruktur.

Ein Wechsel speichert die Auswahl in `localStorage` und
zeigt einen "Reload nötig"-Toast. Daten werden NICHT
zwischen den Modi synchronisiert — was im einen Modus liegt,
ist im anderen unsichtbar, bis ein zukünftiges Sync-Feature
landet.

Die Lokal-Modus-Ansicht zeigt Zeilenanzahlen pro Tabelle, so
siehst du, was wo persistiert ist (users, learningProjects,
sessionMessages, progressCommits etc.).

## Über

Der letzte Abschnitt der Einstellungen zeigt das **Über-Panel**:
fünf Nur-Lese-Blöcke mit Informationen zur laufenden App.

- **Version**: App-Version (aus der kanonischen
  `pyproject.toml`), kurzer Build-Hash (verlinkt zum
  GitHub-Commit, sofern verfügbar) und Build-Datum.
- **System**: Speichermodus (Server vs. lokaler Browser),
  Datenverzeichnis, Datenbank-Pfad (nur im Server-Modus),
  Python-Version (nur im Server-Modus), Plattform und die
  Versionen der gebündelten Backend-Abhängigkeiten (FastAPI,
  SQLAlchemy, Pydantic, PluginForge).
- **Mitwirkende**: Autor, Abhängigkeits-Danksagungen, Tagline.
- **Entwicklung unterstützen**: drei Spendenkanäle — Liberapay
  (bevorzugt), GitHub Sponsors und Ko-fi. Jeder öffnet in einem
  neuen Tab.
- **Lizenz & Ressourcen**: MIT-Lizenz-Link, Repository-Link,
  Dokumentations-Link und der Issue-Tracker.

Im **Lokal (Browser)**-Modus zeigt das Panel dieselbe
Struktur, blendet aber die Zeilen aus, die nur für ein
laufendes Backend Sinn ergeben (Python-Version,
FastAPI/SQLAlchemy/Pydantic/PluginForge-Versionen,
Datenbank-Pfad). Das Speicher-Label wechselt von *Server
(FastAPI + SQLite)* zu *Lokaler Browser-Speicher (IndexedDB)*,
damit immer klar ist, auf welcher Seite du dich befindest.
