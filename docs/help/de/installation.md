# Installation

> **Mit Terminal vertraut?** Der Docker-/curl-Installationsweg steht unter [Erste Schritte](getting-started.md). Diese Seite ist der empfohlene Weg für Nutzer, die eine grafische Installation bevorzugen.

AdaptiveLearner liefert einen Desktop-Launcher für Windows, macOS und Linux. Der Launcher ist ein kleines Programm, das die AdaptiveLearner-Seite der Installation für dich übernimmt (Release herunterladen, Konfiguration vorbereiten, Docker-Images bauen, Browser öffnen). Du musst nur Docker Desktop selbst installieren; den Rest erledigt der Launcher beim ersten Start.

## Voraussetzungen

- Docker Desktop installiert und gestartet. Eine Schritt-für-Schritt-Anleitung pro Plattform inklusive Abschnitt „Ist Docker sicher zu installieren?" findest du in der [AdaptiveLearner-Anleitung zur Docker-Installation](install/docker-desktop.md). Der Launcher prüft Docker beim Start; falls Docker fehlt oder nicht läuft, zeigt er einen Dialog mit drei Schaltflächen (Docker-Downloadseite öffnen, AdaptiveLearner-Docker-Anleitung öffnen, oder Beenden). Der AdaptiveLearner-Launcher kann (und darf gemäß Docker-Lizenzbedingungen) Docker Desktop nicht für dich installieren.

## Plattform wählen

| Plattform | Was wird heruntergeladen | Start |
|-----------|--------------------------|-------|
| [Windows](launcher-windows.md) | `adaptive-learner-launcher.exe` | Doppelklick auf die `.exe`, beim ersten Start SmartScreen bestätigen |
| [macOS](launcher-macos.md) | `adaptive-learner-launcher-macos.zip` (arm64) | Entpacken, Rechtsklick auf das `.app`, beim ersten Start Gatekeeper bestätigen |
| [Linux](launcher-linux.md) | `adaptive-learner-launcher-linux` (ELF-Binary) | `chmod +x`, dann im Terminal oder Dateimanager starten |

Der Kern aller drei Launcher ist gleich:

- Erkennung von Docker Desktop beim Start, mit klarem Dialog, falls es fehlt oder nicht läuft
- Willkommensablauf beim ersten Start (siehe unten), der AdaptiveLearner herunterlädt und einrichtet, falls noch nicht vorhanden
- Browser öffnet sich unter `http://localhost:7880`, sobald der Stack gesund meldet
- Schaltfläche **AdaptiveLearner stoppen** fährt den Stack sauber herunter
- Aktivitätslog mit Rotation (1 MB, 1 Backup) im Konfigurationsverzeichnis der Plattform
- Hinweis auf neue Versionen beim Start (Opt-out in den Einstellungen)

## Was beim ersten Start passiert

Wenn Docker Desktop installiert ist und läuft, AdaptiveLearner selbst aber noch nicht auf der Festplatte liegt, führt dich der Launcher durch die Installation:

1. **Willkommensdialog**: Ein Fenster „Bevor du startest" erscheint beim allerersten Start und erklärt, was AdaptiveLearner braucht (Docker Desktop, ca. 800 MB), wie der erste Start aussieht (ca. 2 GB / 5-10 Minuten), und enthält einen kurzen Hinweis zur Docker-Sicherheit plus Links zur [AdaptiveLearner-Anleitung zur Docker-Installation](install/docker-desktop.md). Klick auf **Verstanden, weiter**, um fortzufahren.
2. **Installations-Aufforderung** (wenn keine AdaptiveLearner-Kopie auf der Festplatte liegt): Ein kurzer Dialog „AdaptiveLearner ist nicht installiert" mit **Installieren** / **Anleitung öffnen** / **Abbrechen**.
3. **Ordner-Auswahl**: Wenn du Installieren gewählt hast, fragt der Launcher, wo AdaptiveLearner liegen soll (Standard: `~/adaptive_learner` auf macOS/Linux, `%USERPROFILE%\adaptive_learner` auf Windows). Du kannst überschreiben; die Wahl wird gemerkt.
4. **Download**: Der Launcher holt die AdaptiveLearner-Release-ZIP von GitHub, entpackt sie und schreibt eine frische `.env` mit generiertem Secret. Schnell (wenige Sekunden bei normaler Verbindung).
5. **Docker-Build**: Docker lädt Basis-Images herunter und baut den AdaptiveLearner-Stack. Der erste Build ist der langsame Teil - typischerweise 3-5 Minuten, je nach Rechner und Verbindung. Spätere Starts überspringen das.
6. **Health-Wait**: Der Launcher wartet, bis das Backend auf Port 7880 als gesund meldet, und öffnet dann den Browser auf `http://localhost:7880`.
7. **Statusfenster**: Ein kleines Fenster bleibt offen und zeigt "AdaptiveLearner läuft auf localhost:7880" mit einer Schaltfläche **AdaptiveLearner stoppen**. Wenn du das Fenster schließt, stoppt der Stack sauber.

Bei späteren Starts werden Willkommensdialog und Installations-Aufforderung übersprungen. Der Launcher erkennt die bestehende Installation über eine Manifest-Datei, führt `docker compose up` aus, wartet auf den Health-Check und öffnet den Browser.

## Vor-Installations-Update-Check

Bevor der Willkommensdialog auf einem frischen Rechner erscheint, fragt der Launcher GitHub, ob er die aktuelle AdaptiveLearner-Version installiert. Ist ein neueres Release verfügbar, erscheint ein Dialog mit drei Optionen: **Download-Seite öffnen** (öffnet die GitHub-Release-Seite im Browser, damit du einen neueren Launcher holen kannst), **Mit älterer Version fortfahren** (bricht den Stale-Check ab und installiert trotzdem, sinnvoll wenn du bewusst eine ältere Version willst), oder **Abbrechen**. Der Check läuft auf einem frischen Rechner immer, unabhängig von der Auto-Update-Einstellung; der Auto-Update-Schalter in den Einstellungen steuert nur die Nach-Installations-Benachrichtigung, die nach dem Start läuft. Ist GitHub nicht erreichbar, läuft der Launcher fail-open und nutzt die eingebettete Zielversion.

## Was der Launcher nicht macht

- **Er installiert Docker Desktop nicht.** Docker-Lizenzbedingungen verbieten eine stille Drittanbieter-Installation, dieser Schritt bleibt manuell. Der Launcher erkennt nur und weist an.
- **Er läuft nicht als Hintergrunddienst.** Der Launcher ist ein Vordergrundprogramm; das Schließen des Fensters stoppt AdaptiveLearner. Wer AdaptiveLearner dauerhaft laufen lassen will, lässt das Launcher-Fenster offen oder nutzt den Terminal-Weg (siehe Erste Schritte) und `docker compose` als Dienst.

## Terminal-Alternative

Wer lieber im Terminal arbeitet - oder den AdaptiveLearner-Lebenszyklus skripten, auf einem Server laufen lassen oder die Launcher-GUI komplett umgehen will - findet in [Erste Schritte](getting-started.md) den Weg. Der Terminal-Pfad nutzt `start.sh` / `stop.sh` und produziert denselben Docker-Stack auf demselben Port. Du kannst beides mischen: per Launcher installieren, per Skript verwalten - oder umgekehrt.

## Wo AdaptiveLearner deine Daten ablegt

Bücher, Uploads und die SQLite-Datenbank liegen im Benutzerdaten-Verzeichnis:

| Plattform | Pfad |
|-----------|------|
| Linux / macOS | `~/.local/share/adaptive_learner/` |
| Windows | `%LOCALAPPDATA%\adaptive_learner\` |
| Docker | `/app/data/` im benannten Volume `adaptive-learner-data` |

Das passiert automatisch. Wer von einer älteren Version (v0.25.0 oder früher) aktualisiert, bei der die Daten innerhalb des Projektverzeichnisses lagen (`backend/adaptive_learner.db`, `backend/uploads/`), für den verschiebt AdaptiveLearner beim ersten Start alles an den neuen Ort und hinterlässt eine `.migrated-YYYY-MM-DD`-Markierung an jedem alten Pfad. So kannst du den Umzug prüfen, bevor du die alten Dateien löschst.

## Konfigurationsverzeichnis

Der Launcher-Zustand (gemerkter Installationspfad, Aktivitätslog, Update-Einstellung) liegt im Standard-Konfigurationsverzeichnis des Benutzers:

| Plattform | Pfad |
|-----------|------|
| Windows | `%APPDATA%\adaptive_learner\` |
| macOS | `~/Library/Application Support/adaptive_learner/` |
| Linux | `~/.config/adaptive_learner/` |

Dieses Verzeichnis kann jederzeit gelöscht werden; der Launcher fragt beim nächsten Start wieder nach dem Installationsordner (oder zeigt den Willkommensablauf, falls keine Installation gefunden wird).

## Deinstallation

Siehe [Deinstallieren](uninstall.md) für den Launcher-Weg und das Skript-Fallback. Das Löschen der Buchdaten (Docker-Volumes) ist auf allen Plattformen Opt-in.

## Weiter

Klicke oben auf deine Plattform. Sobald das Launcher-Fenster "AdaptiveLearner läuft auf localhost:7880" zeigt, geht es in [Erste Schritte](getting-started.md) mit dem ersten Buch weiter.
