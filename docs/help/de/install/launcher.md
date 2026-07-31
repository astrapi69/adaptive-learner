# Desktop-Launcher starten

!!! tip "Die meisten Nutzer brauchen den Launcher nicht"
    Adaptive Learner läuft direkt im Browser, ohne Installation, ohne
    Docker, ohne Launcher:
    **[astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/)**.
    Der Desktop-Launcher ist nur für dich, wenn du die App selbst
    hosten oder Backend-Features (Server-Modus, lokale Synchronisation)
    lokal betreiben möchtest.

Der Desktop-Launcher ist der einfachste Weg, Adaptive Learner **mit
eigenem Backend** auf dem eigenen Rechner zu betreiben. Er ist ein
kleines Fenster, das alles Weitere für dich erledigt: Er prüft, ob
Docker läuft, lädt beim ersten Start das fertig gebaute App-Image aus
der GitHub-Registry (etwa 110-120 MB, wenige Minuten bei normaler
Verbindung - auf deinem Rechner wird nichts gebaut), startet den
Container und öffnet die App anschließend im Browser unter
`http://localhost:8501`. Aus demselben Fenster kannst du die App auch
wieder stoppen, den Port ändern, aktualisieren oder alles
deinstallieren.

## Die drei Installationswege

| Weg | Für wen | Was passiert |
|-----|---------|--------------|
| **Launcher (Standard)** | Alle | Lädt das veröffentlichte Image von `ghcr.io/astrapi69/adaptive-learner` und startet es. Diese Seite. |
| **Registryfrei (Archiv)** | Rechner ohne Registry-Zugang | Lade das Image-Archiv für deinen Prozessor von derselben Release-Seite wie den Launcher und lege es zu den Launcher-Daten - es wird in die hinterlegte Referenz GELADEN statt bezogen. Archiv und Launcher müssen aus dem **selben Release** stammen; eine andere Version führt zum harten Fehler mit Dateinamen. |
| **Aus dem Quellbaum (Entwickler)** | Selbstbauer | Repository klonen, dann `install.sh` oder der Compose-Stack. Baut lokal; durch dieses Release unverändert. |

Der Port ist standardmäßig **8501** und im Launcher-Fenster änderbar;
ist er belegt, weicht der Launcher auf einen freien Port aus. Wenn du
den Browser-Speichermodus nutzt, ändert ein Portwechsel auch, wo deine
Daten liegen - lies vorher [Den Port ändern](changing-the-port.md).

## Voraussetzung: Docker - der Launcher prüft es selbst

Der Launcher setzt ein laufendes Docker voraus, denn die App selbst
läuft in einem Container. Du musst dafür aber **nichts von Hand
prüfen**: Der Launcher kontrolliert beim Start selbst, ob Docker
installiert ist und läuft, findet auch einen Docker, der unter einem
anderen Docker-Kontext läuft (etwa Docker Desktop für Linux oder
rootless Docker), und zeigt dir eine klare Meldung mit Lösung an,
falls etwas fehlt. Falls Docker noch gar nicht installiert ist:
[Docker Desktop installieren](docker-desktop.md).

Die Meldungen des Launchers und was sie bedeuten:

| Meldung | Bedeutung | Lösung |
|---------|-----------|--------|
| "Docker ist nicht installiert (docker nicht im PATH)." | Der `docker`-Befehl wurde nicht gefunden. | [Docker Desktop installieren](docker-desktop.md). Der Launcher zeigt den Installations-Link direkt an. |
| "Docker ist installiert, aber nicht gestartet." bzw. "Docker läuft nicht. Geprüfter Kontext '...' (...): ..." | Der Docker-Dienst läuft gerade nicht; die Detail-Form nennt den geprüften Kontext, den Socket und Dockers Original-Fehler. | Den Knopf **"Docker starten"** im Launcher anklicken (Linux) bzw. Docker Desktop öffnen (macOS/Windows), dann **"Erneut prüfen"**. |
| "Docker ist installiert, aber du hast keine Berechtigung." | Dein Benutzer ist nicht in der `docker`-Gruppe (Linux). | Der Launcher zeigt den passenden Befehl direkt an; danach einmal ab- und wieder anmelden. |
| "Docker antwortet nicht." | Docker startet vermutlich gerade noch (typisch direkt nach dem Öffnen von Docker Desktop). | Einen Moment warten, dann **"Erneut prüfen"**. |
| "Docker läuft über Kontext '...' - der aktive Kontext war nicht erreichbar, der Launcher hat sich automatisch verbunden." | Nur eine Information: Docker lief unter einem anderen Kontext, der Launcher hat ihn gefunden und nutzt ihn. | Nichts zu tun. |
| "Docker Desktop ist installiert, aber nicht im PATH." | Die Docker-Desktop-App ist da, aber ihr Kommandozeilen-Werkzeug (noch) nicht erreichbar. | Docker Desktop über den Launcher-Knopf starten und kurz warten. |

Die Kontext-Erkennung mit Detail-Meldungen ist ab der auf
docker-app-launcher#26 folgenden Launcher-Version enthalten; ältere
Versionen zeigen die kürzeren Meldungen aus derselben Tabelle.

## Download

Alle drei Launcher liegen bei jedem Release unter
[github.com/astrapi69/adaptive-learner/releases](https://github.com/astrapi69/adaptive-learner/releases):

| Plattform | Datei | Prüfsumme |
|-----------|-------|-----------|
| Linux | `adaptive-learner-launcher` | `adaptive-learner-launcher.sha256` |
| macOS | `adaptive-learner-launcher-macos.zip` | `adaptive-learner-launcher-macos.zip.sha256` |
| Windows | `adaptive-learner-launcher.exe` | `adaptive-learner-launcher.exe.sha256` |

### Was geprüft ist und was nicht

Jedes dieser Programme wird beim Bauen einmal gestartet, auf genau dem
Betriebssystem, für das es gedacht ist. Dass es startet, ist damit
belegt - unter Linux, unter Windows und unter macOS auf Apple Silicon.
Das App-Image wird je Release geprüft: ein anonymer Download (ohne
Anmeldung) und ein echter Start mit Gesundheitsprüfung, getrennt für
beide Prozessortypen (Intel/AMD und ARM), auf Maschinen des jeweiligen
Typs. Noch nicht gemessen ist der Registry-Download auf sehr alten
Docker-Engines (20.10-Ära); die Engine-Kette selbst ist auf einer
solchen Engine gegen eine andere Registry belegt, die Messung gegen die
GitHub-Registry läuft upstream.

Nicht belegt ist, wie dein Betriebssystem auf eine **heruntergeladene**
Datei reagiert: die Programme tragen keine kostenpflichtige Signatur,
deshalb warnt macOS beim ersten Öffnen ("nicht verifizierter
Entwickler") und Windows zeigt den SmartScreen-Hinweis. Das ist eine
Warnung, kein Defekt - wie du sie einmalig bestätigst, steht unten bei
[macOS](#macos) und [Windows](#windows). Prüf davor die Prüfsumme; sie
ist der verlässlichere Nachweis als jeder Dialog.

## Linux

1. Prüfsumme verifizieren (beide Dateien im selben Ordner):

    ```bash
    sha256sum -c adaptive-learner-launcher.sha256
    ```

2. Ausführungsrechte setzen. Der Browser-Download nimmt sie dem Binary
   immer, dieser Schritt ist also **immer** nötig:

    ```bash
    chmod +x adaptive-learner-launcher
    ```

3. Starten, am einfachsten im Terminal:

    ```bash
    ./adaptive-learner-launcher
    ```

    Doppelklick im Dateimanager funktioniert je nach Umgebung ebenfalls;
    in GNOME/Nautilus muss dafür unter Eigenschaften > Zugriffsrechte
    "Datei als Programm ausführen" gesetzt sein. Der Terminal-Start hat
    den Vorteil, dass du Fehlermeldungen direkt siehst.

Bekannte Stolpersteine:

- **"Permission denied"**: Schritt 2 vergessen (`chmod +x`).
- **GLIBC-Fehler beim Start**: Das Binary wird auf Ubuntu 22.04 gebaut
  und braucht glibc 2.35 oder neuer (Ubuntu 22.04+, Debian 12+,
  Fedora 36+). Auf älteren Distributionen stattdessen die App per
  `install.sh` oder Docker Compose direkt betreiben.
- **App im Browser nicht erreichbar**: Die App läuft nur lokal
  (`localhost`), eine Firewall-Freigabe ist dafür nicht nötig. Öffnet
  der Browser nicht automatisch, rufe `http://localhost:8501` von Hand
  auf (bzw. den im Launcher-Fenster angezeigten Port).

## macOS

1. Prüfsumme verifizieren und ZIP entpacken:

    ```bash
    shasum -a 256 -c adaptive-learner-launcher-macos.zip.sha256
    unzip adaptive-learner-launcher-macos.zip
    ```

2. Beim ersten Öffnen **blockiert macOS das Programm**. Der Dialog
   bietet je nach macOS-Version nur "In den Papierkorb" und "Fertig" -
   keinen Öffnen-Knopf. Das ist kein Fehler und kein Defekt des
   Programms: Adaptive Learner ist **nicht bei Apple beglaubigt**, denn
   das setzt ein kostenpflichtiges Entwicklerkonto voraus.

   So öffnest du es trotzdem:

    1. Den Dialog mit **Fertig** schließen (nicht in den Papierkorb).
    2. **Systemeinstellungen > Datenschutz & Sicherheit** öffnen und
       nach unten scrollen.
    3. Dort steht, dass das Programm blockiert wurde, mit dem Knopf
       **Dennoch öffnen**. Darauf klicken und im nächsten Dialog
       bestätigen.

   Danach startet es bei jedem weiteren Mal ohne Nachfrage.

   Die Prüfsumme aus Schritt 1 ist in diesem Fall deine eigentliche
   Sicherheit: das System kann dir nicht bestätigen, woher die Datei
   kommt - die übereinstimmende Prüfsumme kann es.


> **Fußnote für technische Nutzer.** `xattr -d com.apple.quarantine <Datei>`
> entfernt die Sperre auch über die Kommandozeile. Das ist bewusst NICHT
> der Weg oben: Menschen beizubringen, eine Schadsoftware-Warnung per
> Terminal-Befehl wegzuräumen, ist genau das, was ein Angreifer von
> seinem Opfer verlangt. Nur nutzen, wenn du verstehst, was er tut, und
> die Prüfsumme geprüft hast.

## Windows

1. Prüfsumme verifizieren (PowerShell, beide Dateien im selben Ordner):

    ```powershell
    Get-FileHash .\adaptive-learner-launcher.exe -Algorithm SHA256
    Get-Content .\adaptive-learner-launcher.exe.sha256
    ```

    Die beiden Hash-Werte müssen übereinstimmen.

2. `adaptive-learner-launcher.exe` doppelklicken. Beim ersten Start
   warnt SmartScreen ("Der Computer wurde durch Windows geschützt"):
   **Weitere Informationen** anklicken, dann **Trotzdem ausführen**.

## Wenn etwas hakt

- Der Launcher zeigt selbst einen Hinweis-Dialog, wenn Docker nicht
  läuft, und bietet an, Docker Desktop zu starten.
- Der erste Start lädt das App-Image; die Schritt-Checkliste im
  Launcher-Fenster zeigt den Fortschritt, jedes geladene Megabyte ist
  sichtbar - nie ein stilles langes Warten. Spätere Starts sind schnell
  und funktionieren offline.
- `--doctor` auf der Kommandozeile liefert einen Bereitschaftsbericht:
  Konfiguration, Docker, Werkzeuge, Port und Zustand - alle
  Voraussetzungen in einem Durchgang.
- Läuft die App, erreichst du sie jederzeit unter
  `http://localhost:8501` (oder deinem geänderten Port); der Button
  "Im Browser öffnen" im Launcher tut dasselbe.
