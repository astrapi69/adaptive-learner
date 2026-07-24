# Backup und Wiederherstellung

Adaptive Learner kann deinen gesamten Lernzustand in eine einzige
Datei sichern und ihn auf einem anderen Gerät, in einer frischen
Installation oder nach einem Browser-Wechsel wiederherstellen. Du
findest alles unter **Einstellungen → Daten**.

<!-- TODO: Screenshot - Einstellungen → Daten mit den Knöpfen „Backup erstellen" und „Wiederherstellen" -->

---

## Was im Backup steckt

Ein Backup ist ein **vollständiger Snapshot**: alle 30
Datentabellen (Lernprojekte, Sessions, Lektionsfortschritt,
element-genaue Fehler, Gamification mit XP/Streak/Badges,
Missionen, Anki-Karten, Notizen und mehr), **deine
heruntergeladenen Content-Sets** und ein **localStorage-Snapshot**
(deine Beiträge, eigene Lernpfade und lokale Einstellungen).
Nichts Wichtiges bleibt zurück.

Vor dem Export zeigt die App eine Vorschau **„Dein Backup
enthält …"** mit Datensatz-Zählungen pro Bereich, damit du vor dem
Speichern siehst, was gesichert wird.

---

## Backup erstellen

1. Öffne **Einstellungen → Daten**.
2. Drücke **Backup erstellen**.
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
übersiehst du keinen Fehler. Im Entwicklermodus (Einstellungen →
Oberfläche) enthält die Meldung die technischen Details für einen
GitHub-Issue.

---

## Cross-Identity-Import

Du musst **nicht** derselbe Nutzer auf demselben Gerät sein. Ein
Backup lässt sich in eine **frische Installation** oder unter
einem **anderen Nutzerprofil** importieren. Die Wiederherstellung
ordnet die Daten dem aktiven Profil zu und löst dabei interne
Verweise (Fremdschlüssel) sauber neu auf, sodass dein Fortschritt
zusammenhängend bleibt - Lektions-Schrittfortschritt, Streak und
Badges inklusive.

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
- [Mehrere Content-Repositories](content-repos.md) - verbundene Repos sind Teil des Snapshots
