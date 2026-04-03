# KI-Arbeitsweise

## Session-Start

Bei der ersten Nachricht einer Session:
1. docs/ROADMAP.md lesen (aktueller Stand, offene Punkte).
2. Letzte Aenderungen pruefen: git log --oneline -10
3. make test laufen lassen (Baseline sicherstellen).
Erst danach mit der Aufgabe beginnen.

## Interpretation von "weiter" / "naechster Punkt"

Wenn der Nutzer "weiter", "naechster Punkt", "mach weiter" oder aehnliches sagt:
1. docs/ROADMAP.md lesen, Sektion "Naechste Schritte".
2. Ersten offenen Punkt (unchecked Checkbox) nennen.
3. Auf Bestaetigung warten, NICHT sofort umsetzen.

## Reihenfolge bei neuen Features

1. Pruefen ob Feature in ein Plugin gehoert oder zum Kern.
2. Bestehende Patterns anschauen (z.B. wie assessment-Plugin aufgebaut ist).
3. Schema/Model zuerst (Pydantic Schema oder TypeScript Interface).
4. Backend-Logik (Service-Modul, dann Route).
5. Frontend (API Client erweitern, dann UI).
6. Tests schreiben.
7. i18n-Strings in allen aktiven Sprachen ergaenzen.
8. Conventional Commit.

## Reihenfolge bei neuen Plugins

1. Plugin-Ordner anlegen: backend/plugins/{name}/
2. plugin.py: {Name}Plugin(BasePlugin) mit name, version, depends_on.
3. @hookimpl-Methoden fuer die relevanten Hooks.
4. YAML-Config: backend/config/plugins/{name}.yaml
5. models.py fuer Plugin-eigene DB-Tabellen (optional).
6. routes.py fuer API-Endpunkte.
7. Tests.
8. Plugin in main.py registrieren (register_plugin).

## Nicht erlaubt (KI-spezifisch)

- Neue Dependencies einfuehren ohne Rueckfrage.
- Architektur-Entscheidungen aendern (z.B. SQLAlchemy ersetzen).
- PluginForge-Code aendern (separates Repo!).
- Plugin-Struktur aendern (BasePlugin, Hook-Specs) ohne Rueckfrage.
- Code generieren der "fuer spaeter" ist. Nur was jetzt gebraucht wird.
- Bestehende Tests loeschen, auskommentieren oder abschwaechen.
- Im autonomen Modus bei Unklarheiten weiterraten. Lieber abbrechen und Unsicherheit dokumentieren.
- Echte API-Keys in Tests oder Code verwenden.

## Kommunikation

- Direkt, sachlich, keine Beschoenigungen.
- Bei Unklarheiten: Nachfragen, nicht raten.
- Wenn etwas gegen die Architektur verstoesst: Sagen, nicht stillschweigend umgehen.
- Vorschlaege willkommen, aber als Vorschlag kennzeichnen.

## Dokumentations-Protokoll

### Wann CLAUDE.md aktualisieren

- Neues Plugin hinzugefuegt
- Neue Dependency im Tech-Stack
- Test-Zahlen haben sich wesentlich geaendert
- Neue Befehle im Makefile
- Verzeichnisstruktur hat sich geaendert
- Neue API-Endpunkte
- Phase abgeschlossen oder neue Phase begonnen
- Version hochgezaehlt

### Wann ROADMAP.md aktualisieren

- Task erledigt: Checkbox auf [x] setzen
- Neuer Task entdeckt: Einfuegen mit naechster freier ID
- Prioritaet geaendert: In "Naechste Schritte" verschieben

### Wann lessons-learned.md aktualisieren

- Neuer Fallstrick entdeckt
- Workaround fuer Library-Limitation gefunden
- AI-Provider-Eigenheit dokumentiert
