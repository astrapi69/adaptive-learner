# Docker Desktop installieren

Adaptive Learner läuft als kleine Gruppe von Containern auf deinem
eigenen Rechner. Der Desktop-Launcher startet und stoppt diese
Container für dich, aber dafür muss zuerst **Docker** installiert sein
und laufen. Diese Anleitung führt dich durch die Installation von
Docker Desktop.

## Was du brauchst

- Etwa 800 MB Download für Docker Desktop selbst.
- Etwa 2 GB Speicher für das Adaptive-Learner-Image beim ersten Start
  (das passiert einmalig; spätere Starts sind schnell).
- Ein paar Minuten für den ersten Build (5-10 Minuten sind normal).

## Installation

1. Öffne die offizielle Docker-Desktop-Downloadseite:
   [docs.docker.com/desktop](https://docs.docker.com/desktop/).
2. Lade das Installationsprogramm für dein Betriebssystem herunter
   (Windows, macOS oder Linux).
3. Starte das Installationsprogramm und folge den Anweisungen.
   Übernimm die Voreinstellungen, sofern du keinen Grund hast, sie zu
   ändern.
4. Starte Docker Desktop und warte, bis das Wal-Symbol
   "Docker Desktop is running" anzeigt.

## Den Launcher starten

Sobald Docker Desktop läuft, starte den Adaptive-Learner-Launcher
erneut. Er prüft zuerst Docker, lädt dann das Image herunter, baut und
startet die App und bietet zum Schluss einen Knopf
"Im Browser öffnen" an.

Falls Docker beim Start des Launchers noch nicht läuft, zeigt er einen
Hinweis mit einem Knopf "Docker starten", damit du Docker hochfahren
kannst, ohne den Launcher zu verlassen.

## Ist Docker sicher zu installieren?

Ja. Docker Desktop stammt von Docker, Inc., einem bekannten
Unternehmen, und wird weltweit von Millionen Entwicklerinnen und
Entwicklern genutzt. Es ist der übliche Weg, containerisierte
Anwendungen auf einem privaten Rechner auszuführen.

Adaptive Learner nutzt Docker ausschließlich, um die eigenen Container
auf deinem Rechner zu betreiben. Deine Lerndaten bleiben lokal; durch
die Installation von Docker werden keine deiner Daten an Docker, Inc.
gesendet. Du kannst Docker Desktop jederzeit über dein Betriebssystem
deinstallieren, wie jede andere Anwendung auch.

## Fehlerbehebung

- **Der Launcher meldet, dass Docker nicht läuft.** Starte Docker
  Desktop, warte auf den Zustand "running" und klicke dann auf
  "Erneut versuchen".
- **Der Port ist bereits belegt.** Der Launcher erkennt das und
  schlägt einen anderen Port vor; übernimm den Vorschlag.
- **Etwas anderes ist schiefgegangen.** Starte den Launcher erneut
  mit dem Flag `--debug` und schicke die erzeugte Datei
  `launcher-debug.log` mit:

  ```bash
  python3 -m adaptive_learner_launcher --debug
  ```
