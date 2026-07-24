# Anleitung: Geräteverifikation Docker-Permission-Fix (docker-app-launcher 0.15.0)

Verifiziert auf einem echten Gerät, dass der in docker-app-launcher
0.15.0 gelieferte Permission-Fix (docker-app-launcher#27/#28) über die
gebauten Adaptive-Learner-Launcher-Binaries tatsächlich funktioniert:

1. Ein Socket-Permission-Fehler wird als solcher gemeldet (nicht mehr
   als "Docker ist nicht gestartet").
2. Die Selbst-Reparatur ("Docker-Zugriff einrichten", pkexec usermod)
   funktioniert, verifiziert gegen `getent group docker`, und verlangt
   ehrlich das Ab-/Anmelden.
3. Nach dem Start von Docker Desktop pollt der Launcher
   (`wait_for_docker`) statt sofort "nicht gestartet" zu melden.

Primär Linux (Punkt 1 + 2 sind Linux-spezifisch); Punkt 3 gilt auf
allen drei Plattformen.

## Binaries beziehen

Bis zum nächsten regulären Release: die frischen Dispatch-Artifacts
(entstanden nach dem 0.15.0-Bump #2024 / PR #2025, verfügbar bis
2026-08-07):

```bash
# Jeweils den neuesten gruenen Dispatch-Run je Plattform nehmen
# (aeltere Runs vor dem #2027-Fix zeigen noch den "My App"-Fenstertitel):
gh run list --repo astrapi69/adaptive-learner --workflow=launcher-linux.yml --limit 3
gh run download <run-id> --repo astrapi69/adaptive-learner --name adaptive-learner-launcher-linux
gh run download <run-id> --repo astrapi69/adaptive-learner --name adaptive-learner-launcher-macos
gh run download <run-id> --repo astrapi69/adaptive-learner --name adaptive-learner-launcher-windows
chmod +x adaptive-learner-launcher
```

Ab dem nächsten Release hängen die 0.15.0-Binaries regulär am
GitHub-Release (Assets-Sektion).

## Teil 0 (alle Plattformen): Branding (#2027)

- [ ] GUI starten: der Fenstertitel lautet "Adaptive Learner" - NICHT
      "My App" (der Paket-Default, den der #2027-Bug bei jedem
      Frozen-Binary zeigte).
- [ ] Fenster-/Taskleisten-Icon: wo der Desktop per-Fenster-Icons
      anzeigt, erscheint die Adaptive-Learner-Marke. Hinweis: GNOME
      unter Wayland ignoriert per-Fenster-Icons weitgehend und zeigt
      ein generisches Icon, solange keine .desktop-Datei installiert
      ist - das ist Compositor-Verhalten, kein Launcher-Fehler.

## Teil 1 (Linux): Permission-Fehler wird korrekt erkannt

Vorbereitung - den Permission-Fall herstellen, ohne das System dauerhaft
zu ändern. Docker-Daemon muss LAUFEN (`systemctl status docker`), der
Testnutzer darf aber nicht auf den Socket zugreifen. Zwei Wege:

- **Weg A (empfohlen, reversibel pro Shell):** In einer Shell, die die
  docker-Gruppe NICHT trägt, testen. Wenn der eigene Nutzer bereits in
  der Gruppe ist: `sg <primärgruppe> -c './adaptive-learner-launcher --check'`
  hilft NICHT zuverlässig; stattdessen einen frischen Testnutzer ohne
  docker-Gruppe anlegen (`sudo useradd -m launchertest`) und als dieser
  testen (`su - launchertest`).
- **Weg B (invasiv, danach Wiederherstellung nötig):** Eigenen Nutzer
  temporär aus der Gruppe nehmen: `sudo gpasswd -d $USER docker`,
  dann VOLLSTÄNDIG ab- und wieder anmelden (die alte Session behält die
  Gruppe sonst).

Checks:

- [ ] `./adaptive-learner-launcher --check` meldet den
      PERMISSION-Fall: Meldung nennt fehlende docker-Gruppen-
      Berechtigung, das `usermod`-Kommando UND explizit das
      Ab-/Anmelden (bzw. Reboot) plus den `newgrp docker`-Hinweis.
      Sie darf NICHT "Docker ist nicht gestartet" / `systemctl start
      docker` lauten - das war der alte Fehler.
- [ ] GUI starten (`./adaptive-learner-launcher`): das No-Docker-Panel
      zeigt den Permission-Text und einen Button
      "Docker-Zugriff einrichten…" (nicht nur die generische
      Installations-Hilfe).

## Teil 2 (Linux): Selbst-Reparatur

- [ ] Button "Docker-Zugriff einrichten…" klicken: ein
      Bestätigungsdialog erscheint und benennt ehrlich, dass
      docker-Gruppen-Mitgliedschaft faktisch Root-Rechten entspricht.
- [ ] Bestätigen: der polkit-Dialog (pkexec) fragt nach dem Passwort;
      danach meldet der Launcher Erfolg und verlangt ausdrücklich
      Abmelden + Neuanmelden. Er darf NICHT behaupten, Docker sei
      jetzt schon nutzbar.
- [ ] Gegenprüfung: `getent group docker` enthält den Nutzer.
- [ ] Negativpfad: polkit-Dialog abbrechen - der Launcher fällt auf
      die manuelle Anleitung zurück, kein stiller Fehlschlag.
- [ ] Nach Ab-/Anmelden: `./adaptive-learner-launcher --check` ist
      grün, App startet normal.

## Teil 3 (alle Plattformen): Warten auf Docker Desktop

- [ ] Docker Desktop/Daemon stoppen, Launcher starten, im Panel
      "Docker starten" wählen: der Launcher zeigt eine laufende
      Fortschrittsanzeige mit "Docker … startet"-Hinweis und pollt,
      statt sofort wieder "nicht gestartet" zu melden.
- [ ] Sobald der Daemon oben ist, geht der Flow ohne weiteren Klick
      weiter (bzw. meldet Erfolg).
- [ ] Timeout-Fall (optional): Docker gar nicht starten lassen - nach
      dem Poll-Timeout kommt eine klare Fehlermeldung, kein Hänger.

## Wiederherstellung

- Weg B rückgängig: `sudo usermod -aG docker $USER` + Ab-/Anmelden
  (oder: der Selbst-Reparatur-Button hat das bereits erledigt).
- Testnutzer entfernen: `sudo userdel -r launchertest`.

## Ergebnis eintragen

Ergebnis (Datum, Gerät, Distro, bestanden/nicht bestanden je Teil) als
Kommentar auf Issue #2024 oder in die Geräte-Check-Liste
(`geraete-check-liste.md`) übernehmen; Abweichungen als eigenes Issue
mit `bug`-Label (GITHUB-ISSUE-PFLICHT).
