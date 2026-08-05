# Den Port ändern (und deine Daten mitnehmen)

Im Desktop-Launcher kannst du den Port ändern, unter dem Adaptive
Learner läuft (Standard ist **8501**). Das ist praktisch, wenn eine
andere Anwendung diesen Port schon belegt - aber es gibt eine
Auswirkung, die du vorher kennen solltest.

## Warum der Port für deine Daten wichtig ist

Der Speicher einer Web-Anwendung ist an ihre genaue Web-Adresse
gebunden, den Port eingeschlossen. `http://localhost:8501` und
`http://localhost:8502` sind für den Browser zwei **verschiedene**
Adressen, und jede bekommt ihren eigenen, getrennten Speicher.

Was das konkret bedeutet, hängt davon ab, wie du Adaptive Learner
betreibst:

- **Servermodus** (der Standard beim Desktop-Launcher). Deine Sets,
  Lektionen und dein Fortschritt liegen im eigenen Backend der App,
  nicht im Browser. Ein Portwechsel betrifft sie **nicht** - die App
  findet sie unter der neuen Adresse automatisch wieder.
- **Browser-Speichermodus** (die Option, die du unter
  *Einstellungen > Daten* aktivieren kannst, und der Modus der
  öffentlichen Web-Version). Deine Sets, dein Fortschritt und deine
  selbst erstellten Übungen liegen **im Browser**, gebunden an die
  aktuelle Adresse. Nach einem Portwechsel öffnet die App unter der
  neuen Adresse mit leerem Browser-Speicher, es sieht also aus wie ein
  Neustart. **Deine Daten sind nicht gelöscht** - sie liegen weiterhin
  unter dem vorherigen Port, sind unter der neuen Adresse nur nicht
  sichtbar.

## Deine Daten zum neuen Port mitnehmen

Wenn du den Browser-Speichermodus nutzt und den Port schon geändert
hast, warten deine Daten unter der alten Adresse. Hol sie dir mit einem
Backup herüber:

1. Wechsle **zurück zum vorherigen Port** (zum Beispiel
   `http://localhost:8501`). Deine Daten erscheinen wieder.
2. Öffne **Einstellungen > Daten > Backup exportieren** und speichere
   die `.alb`-Datei.
3. Wechsle zum **neuen Port**.
4. Wähle auf dem Willkommensbildschirm **Aus Backup wiederherstellen**
   und öffne die `.alb`-Datei. Alles - Sets, Fortschritt, Übungen und
   deine Einstellungen - wird wiederhergestellt.

Mehr zu Backups findest du unter
[Backup und Wiederherstellung](../features/backup.md).

## Der Überraschung vorbeugen: vorher ein Backup anlegen

Am sichersten ist es, **vor dem Portwechsel ein Backup zu exportieren**,
damit du es auf der neuen Adresse wiederherstellen kannst, falls etwas
fehlt. Ein regelmäßiges Backup ist ohnehin eine gute Absicherung - damit
kannst du dein Lernen auch zwischen Geräten mitnehmen.

## Ein Portwechsel öffnet die App nicht fürs Netzwerk

Egal welchen Port du wählst: Die App lauscht weiterhin nur auf
`127.0.0.1` - erreichbar von diesem Rechner, nicht von anderen Geräten.
Sie hat keine Anmeldung; sie vom Handy oder einem anderen Rechner aus
zu erreichen ist ein eigener, bewusster Schritt
(`ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0`) und nur in einem Netz
sinnvoll, dem du vertraust - siehe
[Desktop-Launcher starten](launcher.md) ("Wer die App erreichen kann").
