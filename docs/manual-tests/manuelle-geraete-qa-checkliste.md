# Manuelle Geräte-QA - Konsolidierte Checkliste (Stand 25.07.2026)

Alles hier kann NUR von dir erledigt werden. Zwei Sessions, einmal iPhone, einmal Ubuntu.

## Session A: iPhone (iOS PWA/Standalone)

Voraussetzung: #2050 gemerged, aktueller develop-Stand deployed (bzw. Preview).

### A1. BACKUP-AKZEPTANZTEST (Launch-Gate, seit frühen Sessions offen)

**Wichtig zur Einordnung:** Die automatisierte Wiederherstellungs-Spec läuft seit Mai nicht mehr. Dieser manuelle Test ist damit derzeit nicht eine zusätzliche Bestätigung, sondern die einzige Abdeckung des wichtigsten Datenpfades im Produkt.
Echter Round-Trip, keine Simulation:
1. App im Standalone-Modus mit realen Daten: mindestens ein importiertes Set, Lernfortschritt in mehreren Lektionen, ein Set auf "zurückgestellt" (deferred), ein Set abgeschlossen, eigene Übung angelegt.
2. Backup exportieren (.alb), Datei nachweislich außerhalb der App sichern (Dateien-App/AirDrop).
3. Harter Wipe: App-Daten vollständig löschen (Safari-Websitedaten für die Domain entfernen, App neu installieren/öffnen - das ist die echte WKWebView-Eviction, nicht localStorage.clear()).
4. Frischer Zustand verifizieren: App leer.
5. Backup importieren.
6. Prüfen: Lernfortschritt vorhanden, Deferred-Markierung vorhanden (der #2050-Pfad!), abgeschlossenes Set korrekt, eigene Übung vorhanden, Einstellungen plausibel.
7. Danach eine Lektion normal weiterlernen - kein Folgefehler.

Ergebnis dokumentieren (auch Teilfehler einzeln). Bei JEDEM Abweichen: Screenshot + welcher Schritt, daraus wird ein Issue mit Forensik.

### A1b. Recovery-Round-Trip (geschuldete Vorbedingung, nachzuholen)

Dieser Punkt war als Vorbedingung des Merges von #2171 formuliert und wurde übergangen. Er wird hier nachgeholt, nicht weggelassen.

1. Prüfen, ob der Wiederherstellungs-Hinweis von selbst erscheint. Erscheint er, liegen echte betroffene Daten vor, dann hier prüfen und **vorher sichern**.
2. Erscheint er nicht, wandert die Prüfung auf den Desktop, wo der Zustand mit Entwicklerwerkzeugen herstellbar ist. Die Anleitung dazu steht im Testplan. Im iOS-Standalone-Modus ist das nicht möglich, weil dafür ein Mac nötig wäre.
3. Wiederherstellen wählen, danach prüfen: Fortschritt zugeordnet, keine verwaisten Zeilen, Zahlen in der Rückmeldung plausibel.
4. Danach das vor der Wiederherstellung erstellte Backup importieren: Der alte Zustand kommt zurück und der Hinweis erscheint wieder. Das ist erwartetes Verhalten.

**Konsequenz bei einem Fund:** Patch in einem Folgerelease, kein Rollback. Der Hinweis ist zustandsgetrieben und erreicht niemanden, der nicht betroffen ist. Nicht improvisieren, Fund melden.

### A2. #2039 Mobile Scroll-to-Error (Visual-Device-Check vor Merge)
1. Formular mit Validierungsfehler außerhalb des Viewports provozieren (langes Formular, Fehler oben, abschicken von unten).
2. Erwartet: automatischer Scroll zum ersten Fehlerfeld, Fehler sichtbar und fokussiert.
3. Einmal Hochformat, einmal mit eingeblendeter Tastatur.

### A3. Rückstands-Issues iOS
Die offenen iOS-Verifikationspunkte aus dem Tracker in derselben Session abarbeiten (Liste aus den jeweiligen Issues, jeweils Ergebnis als Issue-Kommentar).

### A4. Lektion löschen (#2064, gemerged) - überschneidet sich mit A1
Dieses Feature verlangt laut Testplan beide Speichermodi plus Backup-Round-Trip inklusive iOS-Standalone. Das ist in der Substanz derselbe Ablauf wie A1. Beides in einem Durchgang erledigen:
1. In "Meine Inhalte" eine Lektion mit vorhandenem Lernfortschritt löschen.
2. Bestätigungsdialog prüfen: Nennt er den Lernfortschritt (gelernte Karten), nicht nur die Übungszahl?
3. Nach dem Löschen: Lektion weg, keine verwaisten Karten in der Wiederholung, Favorit entfernt, Nummerierung mit Lücke wie entschieden.
4. Backup von VOR dem Löschen importieren: Lektion kommt zurück (Backup ist ein Zeitpunkt, so entschieden). Das ist erwartetes Verhalten, kein Fehler.
5. Beide Speichermodi.

### A5. Wizard-Schritt-Reset (#2061, gemerged) - kurz, auch am Desktop möglich
1. Buch-Set öffnen, "Lektion bearbeiten", zu Schritt 2 navigieren.
2. Im Dropdown ein anderes Kapitel wählen: Schritt 2 bleibt, Übungen der neuen Lektion erscheinen.
3. Randfälle: Wechsel zu einer Lektion ohne Übungen, Rückwärtswechsel.


## Session B: Ubuntu (Launcher-Binary, nach dem ersten GHCR-Release)

Voraussetzung: **Ein Release muss durchgelaufen sein, sodass das Image unter der konfigurierten GHCR-Referenz tatsächlich existiert.** Vorher scheitert die Installation am Bezug und der Lauf beweist nichts. Pin steht auf 0.25.1, Modus ist `image`, K1 bestätigt: einzelner Service.

**Vorher Daten sichern.** Nach dem Volume-Fix mountet der Launcher das präfixierte Volume, und das ist dein Juni-Volume mit der echten Datenbank vom 22.06. Der Lauf arbeitet auf realen Daten. Also: Backup-Export aus der App, zusätzlich eine Kopie des Volumes, und erst dann anfangen. Die Sicherung einmal zurücklesen, nicht nur prüfen dass die Datei existiert. Ein anonymes Volume aus einem parallelen Prozess steht ebenfalls auf dem Gerät, vor dem Lauf entfernen oder bewusst stehen lassen, damit der Ausgangszustand bekannt ist.

### Bereits bewiesen am 30.07. (nicht erneut prüfen)

Ein Lauf auf dem QA-Gerät mit den damaligen Binaries ist bis einschließlich Bezugsversuch durchgelaufen. Damit ist belegt, auf Docker der 20.10-Generation und mit dem defekten gcloud-Helfer in der Konfiguration:

- Docker wird korrekt erkannt, nicht als nicht gestartet fehldiagnostiziert
- Offline-Vorwarnung erscheint an der richtigen Stelle
- Kein Absturz an der Anmeldedaten-Auflösung, trotz defektem Credential-Helfer
- Kein Compose, kein buildx, kein Bau-Kontext erforderlich
- Der Fehler beim fehlenden Image kommt benannt und handlungsleitend, nicht als Bibliotheksmeldung

### Gruppe 1: bisher unbewiesen, zuerst prüfen

1. Binary herunterladen, Prüfsumme vergleichen, ausführbar machen. **Zuerst `--doctor`:** ein Durchgang, der Konfiguration, Daemon, Werkzeuge, Bereitschaftsblocker, Port und Zustand meldet. Ergebnis notieren, bevor du etwas anklickst.
2. Launcher starten. Fenster erscheint, Versionszeile im Log. Deine `~/.docker/config.json` mit dem defekten gcloud-Helfer bleibt **unverändert**.
3. Daemon läuft, Nutzer NICHT in der docker-Gruppe: Meldung sagt Berechtigung und nennt den Reparaturbefehl, NICHT "Docker ist nicht gestartet". [seit dem 0.16.0-Fehlschlag ohne realen Beweis]
4. Nach Gruppenbeitritt und echter Neuanmeldung: Status wird grün.
5. **Kernbeweis:** Installation anstoßen. Der Bezug läuft auf dem Alt-Docker über die Engine-API durch, ohne Compose-Plugin und ohne buildx. Container startet, App unter dem angezeigten Port erreichbar, Frontend und Gesundheitsendpunkt antworten. Im Log keine Credential-Zeile. Das ist die einzige Aussage, die CI bisher nicht liefern kann.

### Gruppe 2: neu seit 0.24.0, wertvoll aber nicht gatend

6. Konsole sichtbar, Kommandos und Exit-Codes im Log, Text-Wrap korrekt, Fenster resizable. Branding "Adaptive Learner", About: Launcher 0.25.1, App 2.7.0 mit Quellen-Label.
7. **Fortschrittsbalken:** Er verschwindet nach Erfolg und nach Fehlschlag. Ein stehenbleibender Balken ist ab 0.25.x ein Befund und kein bekannter Fehler mehr.
8. **Abbrechen:** Bezug starten, abbrechen. Balken weg, Meldung nennt die behaltenen Schichten, Installation sofort erneut möglich, zweiter Versuch spürbar schneller.
9. **Abbruch einer Aktualisierung:** früh abbrechen. Meldung sagt, dass die App gestoppt ist und dass Start die vorherige Version zurückbringt. Start drücken, prüfen dass sie zurückkommt.
10. Bei Stoppen und Deinstallieren erscheint **kein** Abbrechen-Bedienelement.
11. **Nebenläufigkeitsschutz:** Die Notiz, dass er nicht wirken kann, darf beim Erststart **nicht** erscheinen. Erscheint sie, zeigt die Konfiguration auf ein unschreibbares Verzeichnis, und das ist ein Befund.
12. Nach einem Abbruch `--doctor` erneut: die Zeile zum letzten Vorgang zeigt den Abbruch.
13. Zweitstart bei laufendem Launcher: fokussiert das bestehende Fenster. Deinstallieren: Container und Volume weg, keine Reste unter `~/.config` und `~/.local/share`.

### Gruppe 3: nur mit Wegwerf-Profil, zuletzt

14. **Portwechsel.** Die App speichert origin-gebunden. Nach einem Portwechsel wirkt sie leer, der Lernfortschritt liegt weiter unter dem alten Port, aber unerreichbar. Nicht mit echten Lerndaten prüfen, solange das Origin-Risiko offen ist.

## Reihenfolge-Empfehlung

Session A zuerst und in einem Durchgang: A1, A1b und A4 teilen sich denselben Backup-Round-Trip, das ist ein Durchgang und nicht drei, A2 und A5 sind kurze Zusatzprüfungen. Damit fällt in einer Sitzung das älteste Launch-Gate zusammen mit zwei frisch gemergten Features. Session B erst, wenn ein Release durchgelaufen ist und das Image unter der konfigurierten Referenz existiert.
