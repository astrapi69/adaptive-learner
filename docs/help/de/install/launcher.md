# Desktop-Launcher starten

Der Desktop-Launcher ist der einfachste Weg, Adaptive Learner auf dem
eigenen Rechner zu betreiben. Er ist ein kleines Fenster, das alles
Weitere für dich erledigt: Er prüft, ob Docker läuft, lädt und baut beim
ersten Start das App-Image (einmalig, 5-10 Minuten sind normal), startet
die Container und öffnet die App anschließend im Browser unter
`http://localhost:8501`. Aus demselben Fenster kannst du die App auch
wieder stoppen, den Port ändern oder alles deinstallieren.

Der Port ist standardmäßig **8501** und im Launcher-Fenster änderbar;
ist er belegt, weicht der Launcher auf einen freien Port aus.

## Voraussetzung: Docker ist installiert UND läuft

Der Launcher setzt ein laufendes Docker zwingend voraus, denn die App
selbst läuft als Container-Gruppe. Die häufigste Ursache für einen
fehlschlagenden Start ist nicht der Launcher, sondern ein Docker, das
zwar installiert ist, aber gerade nicht läuft. Falls Docker noch fehlt:
[Docker Desktop installieren](docker-desktop.md).

So prüfst du beides, bevor du den Launcher startest:

### Linux

```bash
docker --version   # ist Docker installiert?
docker info        # laeuft der Daemon wirklich?
```

Meldet `docker info` einen Verbindungsfehler, starte den Dienst:

```bash
systemctl status docker    # Zustand ansehen
sudo systemctl start docker
```

Wenn `docker info` nur mit `sudo` funktioniert, fehlt dein Benutzer in
der `docker`-Gruppe:

```bash
sudo usermod -aG docker $USER
```

Danach einmal ab- und wieder anmelden, sonst greift die
Gruppenänderung nicht.

### macOS

Docker Desktop muss installiert **und gestartet** sein (Wal-Symbol in
der Menüleiste sichtbar). Docker Desktop startet nach einem Neustart
des Macs nicht automatisch, außer du hast es in dessen Einstellungen so
konfiguriert. Bestätigen im Terminal:

```bash
docker info
```

### Windows

Docker Desktop (mit WSL2-Backend) muss installiert und gestartet sein.
Bestätigen in PowerShell:

```powershell
docker info
```

Meldet Docker Desktop ein WSL2-Problem, folge seinem Hinweis; WSL2 ist
die Voraussetzung des Docker-Desktop-Backends, nicht des Launchers
selbst.

## Download

Alle drei Launcher liegen bei jedem Release unter
[github.com/astrapi69/adaptive-learner/releases](https://github.com/astrapi69/adaptive-learner/releases):

| Plattform | Datei | Prüfsumme |
|-----------|-------|-----------|
| Linux | `adaptive-learner-launcher` | `adaptive-learner-launcher.sha256` |
| macOS | `adaptive-learner-launcher-macos.zip` | `adaptive-learner-launcher-macos.zip.sha256` |
| Windows | `adaptive-learner-launcher.exe` | `adaptive-learner-launcher.exe.sha256` |

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

2. Beim ersten Öffnen blockiert Gatekeeper das Binary als "nicht
   verifizierter Entwickler". Zwei Wege:

    - Rechtsklick (bzw. Ctrl-Klick) auf das Binary > **Öffnen** > im
      Dialog erneut **Öffnen**. Das merkt sich macOS für alle weiteren
      Starts.
    - Oder: Systemeinstellungen > **Datenschutz & Sicherheit** > unten
      bei der blockierten App auf **Dennoch öffnen**.

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
- Der erste Start lädt und baut das App-Image; die Schritt-Checkliste
  im Launcher-Fenster (Check Docker / Download / Build / Start / Ready)
  zeigt den Fortschritt. Spätere Starts sind schnell.
- Läuft die App, erreichst du sie jederzeit unter
  `http://localhost:8501` (oder deinem geänderten Port); der Button
  "Im Browser öffnen" im Launcher tut dasselbe.
