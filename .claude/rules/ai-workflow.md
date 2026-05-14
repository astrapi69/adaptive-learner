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
6. Tests schreiben (pytest, Vitest).
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

## Reihenfolge bei Aenderungen

1. Bestehende Tests lesen und verstehen.
2. Aenderung implementieren.
3. Tests anpassen oder erweitern.
4. Sicherstellen dass `make test` gruen bleibt.

## Nicht erlaubt (KI-spezifisch)

- Neue Dependencies einfuehren ohne Rueckfrage.
- Architektur-Entscheidungen aendern (z.B. SQLAlchemy ersetzen).
- PluginForge-Code aendern (separates Repo!).
- Plugin-Struktur aendern (BasePlugin, Hook-Specs) ohne Rueckfrage.
- Code generieren der "fuer spaeter" ist. Nur was jetzt gebraucht wird.
- Bestehende Tests loeschen, auskommentieren oder abschwaechen.
- Im autonomen Modus bei Unklarheiten weiterraten. Lieber abbrechen und Unsicherheit dokumentieren.
- Echte API-Keys in Tests oder Code verwenden.
- HTTPException aus Service-Funktionen werfen. Services werfen eigene Exceptions (siehe code-hygiene.md).

## Kommunikation

- Direkt, sachlich, keine Beschoenigungen.
- Bei Unklarheiten: Nachfragen, nicht raten.
- Wenn etwas gegen die Architektur verstoesst: Sagen, nicht stillschweigend umgehen.
- Vorschlaege willkommen, aber als Vorschlag kennzeichnen.

## Self-Clarification Rule

Wenn eine Frage mitten in der Arbeit auftaucht, die sich nicht aus dem Kontext beantworten laesst, NICHT raten. Drei Optionen, in dieser Reihenfolge:

1. **Aus dem Repo beantworten.** Git-History, benachbarte Dateien, Rules, bestehende Patterns pruefen. Wenn eine begruendbare Antwort im Repo existiert, nutzen und die Basis im Bericht notieren.

2. **Frage parken mit klarem Marker.** Wenn keine Evidenz die Frage loest, den Abschnitt so gut wie moeglich mit der konservativsten Annahme schreiben, die Stelle im File mit `<!-- TODO(clarify): <konkrete Frage> -->` markieren und weitermachen.

3. **Stoppen und fragen** NUR wenn die Frage den weiteren Fortschritt blockiert.

Am Ende jeder Session MUSS der Bericht eine "Fragen und Annahmen"-Sektion enthalten.

## Numerische Behauptungen verifizieren

Jede numerische Behauptung ueber das Projekt muss durch Ausfuehren des massgeblichen Befehls in derselben Session verifiziert werden. Das gilt fuer:

- Test-Anzahlen, Coverage-Prozentsaetze
- Datei-Anzahlen, Zeilen-Anzahlen
- Plugin-Anzahlen
- Jede "N bestanden / N fehlgeschlagen"-Statistik

Verifizierung bedeutet: den tatsaechlichen Befehl ausfuehren, NICHT:
- Grep-Output (kann Eintraege uebersehen)
- Erinnerung an fruehere Zahlen
- Ableitung aus einer anderen Zahl

### Verifizierungsbefehle

- **Backend Tests:** `cd backend && poetry run pytest --collect-only -q | tail -5`
- **Frontend Vitest:** `cd frontend && npx vitest --run --reporter=verbose 2>&1 | tail -5`

## Dokumentations-Protokoll

### CLAUDE.md aktualisieren wenn

- Neues Plugin hinzugefuegt
- Neue Dependency im Tech-Stack
- Test-Zahlen wesentlich geaendert
- Neue Befehle im Makefile
- Verzeichnisstruktur geaendert
- Neue API-Endpunkte
- Phase abgeschlossen oder neue Phase begonnen
- Version hochgezaehlt

CLAUDE.md muss schlank bleiben (Ziel: unter 8000 Zeichen). Nur was IMMER relevant ist.

### ROADMAP.md aktualisieren wenn

- Task erledigt: Checkbox auf [x] setzen
- Neuer Task entdeckt: Einfuegen mit naechster freier ID
- Prioritaet geaendert: In "Naechste Schritte" verschieben

### ROADMAP Priority Tiers

| Tier | Bedeutung |
|------|-----------|
| **P0** | Deadline, aktiver Blocker, Security |
| **P1** | Architektur-/Hygiene-Schulden, Regelverletzungen |
| **P2** | User-Features mit hohem Wert |
| **P3** | Infrastruktur, Test-Coverage, interne Refactors |
| **P4** | Spaetere Phasen |
| **P5** | Spekulativ, kein konkreter Trigger |

### lessons-learned.md aktualisieren wenn

- Neuer Fallstrick entdeckt
- Workaround fuer Library-Limitation gefunden
- AI-Provider-Eigenheit dokumentiert

### End-of-Session Flow

1. Pruefen ob CLAUDE.md, CONCEPT.md, ROADMAP.md oder lessons-learned.md Updates brauchen.
2. Alles committen: `docs: update documentation`
3. Bei groesseren Milestones: Zusammenfassung mit Statistiken.

## Single Source of Truth fuer volatile Statistiken

Zahlen die sich mit jedem Feature oder Test aendern, leben an EINEM kanonischen Ort. Andere Dokumentation referenziert diesen Ort statt die Zahl zu duplizieren.

| Statistik | Kanonischer Ort |
|-----------|----------------|
| Test-Anzahlen | `make test` Output |
| Methoden-Keys | `backend/app/hookspecs.py` |
| Unterstuetzte Sprachen | `backend/config/i18n/` (Verzeichnislisting) |
| Plugin-Katalog | `CLAUDE.md` Plugin-Tabelle |

Nie Zahlen duplizieren. Eine einzige Quelle ist immer korrekt.
