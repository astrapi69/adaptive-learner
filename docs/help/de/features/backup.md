# Backup und Wiederherstellung

Adaptive Learner kann deinen gesamten Lernzustand in eine einzige
Datei sichern und ihn auf einem anderen Gerät, in einer frischen
Installation oder nach einem Browser-Wechsel wiederherstellen. Du
findest alles unter **Einstellungen → Daten**.

<!-- TODO: Screenshot - Einstellungen → Daten mit den Knöpfen „Sicherung erstellen" und „Aus Sicherung wiederherstellen" -->

---

## Was im Backup steckt

Ein Backup ist ein **vollständiger Snapshot**: alle
Datentabellen (Lernprojekte, Sitzungen, Lektionsfortschritt,
element-genaue Fehler, Gamification mit XP/Serie/Badges,
Missionen, Anki-Karten, Notizen und mehr), **deine
heruntergeladenen Content-Sets** und ein **localStorage-Snapshot**
(deine Beiträge, eigene Lernpfade und lokale Einstellungen).

**Auch enthalten:** verbundene Content-Repositories, eingelöste
Einladungen und ob das Learning Repository eingeschaltet ist.
Im Browser-Modus kommen auch die Ergebnisse deiner KI-Inhaltsprüfungen
mit, die Plakette „KI-geprüft" bleibt also erhalten.

**Nicht enthalten** sind zum Beispiel:

- das Zugriffstoken eines privaten Repositorys (gib es nach der
  Wiederherstellung erneut ein);
- der Ordner des Learning Repository, der zum Gerät gehört;
- im Server-Modus Lektionsfortschritt und Sprachaufnahmen, die offline
  entstanden und noch nicht beim Server angekommen sind;
- zwischengespeicherte Suchindizes und Medienlisten, die Zählung des
  Auto-Backups und der Stand der LAN-Synchronisierung.

Die Einstellung, ob Auto-Backup eingeschaltet ist, kommt dagegen mit.
Im Server-Modus merkt sich die App, was offline entsteht, in diesem
Browser: bis zu 50 Änderungen an Lektionsfortschritt und
Sprachaufnahmen; kommen mehr zusammen, fallen die ältesten weg. Sie
überträgt sie von selbst, wenn die Verbindung zurückkommt, während die
App offen ist, oder beim nächsten Start mit Verbindung. Von dem, was offline entsteht, kommt nur ins Backup, was schon beim Server
angekommen ist; erstelle ein Backup im Server-Modus deshalb erst, wenn die
App nach dem Offline-Lernen wieder mit Verbindung lief und die Änderungen
übertragen konnte.

Vor dem Export zeigt die App eine Vorschau **„Dein Backup
enthält …"** mit Datensatz-Zählungen pro Bereich, damit du vor dem
Speichern siehst, was gesichert wird.

---

## Backup erstellen

1. Öffne **Einstellungen → Daten**.
2. Drücke **Sicherung erstellen**.
3. Im reinen Browser-Modus kannst du über die
   File-System-Access-API direkt einen Speicherort wählen
   („Auf Datenträger speichern"); unterstützt der Browser das
   nicht, lädt die App die Datei stattdessen herunter.

**Auto-Backup:** Optional hält die App einen rollenden Ring aus
den letzten Snapshots, damit du nie ganz ohne Sicherung dastehst.

---

## Wiederherstellen

1. **Einstellungen → Daten → Wiederherstellen**.
2. Wähle die Backup-Datei.
3. Die App importiert jede Tabelle und scrollt nach oben zu einer
   **Zusammenfassung pro Tabelle** (hinzugefügt / aktualisiert /
   übersprungen), damit du genau siehst, was eingespielt wurde.

Geht beim Import etwas schief, erscheint ein **dauerhafter
Fehler-Hinweis** (Toast), der nicht von selbst verschwindet - so
übersiehst du keinen Fehler. Im Entwicklermodus (Einstellungen >
Diagnose & Support) enthält die Meldung die technischen Details für einen
GitHub-Issue.

---

## Cross-Identity-Import

Du musst **nicht** derselbe Nutzer auf demselben Gerät sein.

- **Auf einem leeren Gerät** spielst du das Backup am besten gleich beim
  Start ein (siehe "Backup beim ersten Login"). Die App übernimmt dann das
  Profil aus dem Backup.
- **Auf einem Gerät, auf dem du schon ein Profil angelegt hast**, kannst du
  das Backup über Einstellungen > Daten importieren. Gehört es zu einem
  anderen Profil, sagt dir der Bestätigungsdialog das vor dem Import. Der
  Lernstand aus dem Backup wird dann deinem **aktiven Profil** zugeordnet
  und mit deinem zusammengeführt: Lektionsfortschritt, Fehler,
  Durchgänge, Aufnahmen, Projekte und Verlauf kommen hinzu, dein eigener
  Fortschritt bleibt erhalten. XP, Serie und Einstellungen übernimmt der
  Import aus dem Backup. Dein aktives Profil bleibt aktiv, es wird kein
  zweites Profil angelegt.

---

## Backup beim ersten Login

Startest du die App neu (oder zum ersten Mal auf einem Gerät),
bietet dir Adaptive Learner aktiv an, ein vorhandenes Backup
einzuspielen, statt mit leerem Zustand zu beginnen. So findest du
nach einem Geräte- oder Browser-Wechsel sofort zurück in deinen
Lernfluss.

---

## Beide Speichermodi

Backup und Wiederherstellung funktionieren in **beiden**
Speichermodi - Server (API) und reiner Browser (Dexie/IndexedDB).
Das Backup ist eine **`.alb`-Datei** - ein ZIP-Archiv, das die
Datentabellen, den localStorage-Snapshot und die Content-Sets
bündelt. `.alb`-Dateien werden an jeder Backup-Import-Stelle
akzeptiert (Einstellungen → Daten und die Danger Zone). Ältere
reine JSON-Backups lassen sich weiterhin sauber importieren.

!!! note "Datenschutz"
    Das Backup bleibt vollständig in deiner Hand. Es wird nur dort
    gespeichert, wohin du es legst - nichts wird an einen Server
    gesendet.

---

## Verwandte Seiten

- [Einstellungen](../user-guide/settings.md) - alle Daten-Aktionen im Überblick
- [Mehrere Content-Repositories](content-repos.md) - verbundene Repos und eingelöste Einladungen reisen mit dem Backup
