# Manueller Testplan - Adaptive Learner v2.3.0+

Stand: 18.07.2026 (Session 6, nach dem v2.3.0-Release)
Tester: Aster + Beta-Tester

Navigations-Hinweis: Der Content-Bereich ist ein Tab-Hub unter `/content`
(`?tab=discover` = Entdecken, `?tab=my` = Meine Inhalte, `?tab=import` =
Import). Die alten Routen `/discover` + `/import` leiten weiter. **Meine
Lektionen**, der **Lektion-Import**, **Bearbeiten**, **Als Datei speichern**
und **Zu Set kombinieren** liegen alle im Tab **Meine Inhalte** (`?tab=my`).
Backup + KI-Schlüssel-Tresor (KeyVault) liegen unter **Settings → Daten**;
die Provider-Übersicht unter **Settings → KI**; Content-Repos unter
**Settings → Daten**.

Struktur:
- TEIL A: Was DU manuell testen musst (nach Priorität)
- TEIL B: Was automatisiert ist (Referenz, nachtraeglich pruefbar)

Für jeden manuellen Testfall: OK / BUG (Screenshot + Browser + Beschreibung)

---

# TEIL A: MANUELLE TESTS (Aster)

Sortiert nach Priorität. Launch-Blocker zuerst.

---

## Manuelle Geräte-QA - Konsolidierte Checkliste (Stand 25.07.2026)

Alles hier kann NUR manuell erledigt werden. Zwei Sessions, einmal iPhone,
einmal Ubuntu.

### Session A: iPhone (iOS PWA/Standalone)

Voraussetzung: #2050 gemerged, aktueller develop-Stand deployed (bzw.
Preview).

#### A1. BACKUP-AKZEPTANZTEST (Launch-Gate, seit frühen Sessions offen)

Echter Round-Trip, keine Simulation:

- [ ] App im Standalone-Modus mit realen Daten: mindestens ein importiertes
      Set, Lernfortschritt in mehreren Lektionen, ein Set auf
      "zurückgestellt" (deferred), ein Set abgeschlossen, eigene Übung
      angelegt.
- [ ] Backup exportieren (.alb), Datei nachweislich ausserhalb der App
      sichern (Dateien-App/AirDrop).
- [ ] Harter Wipe: App-Daten vollständig löschen (Safari-Websitedaten für
      die Domain entfernen, App neu installieren/öffnen - das ist die echte
      WKWebView-Eviction, nicht `localStorage.clear()`).
- [ ] Frischen Zustand verifizieren: App leer.
- [ ] Backup importieren.
- [ ] Prüfen: Lernfortschritt vorhanden, Deferred-Markierung vorhanden (der
      #2050-Pfad!), abgeschlossenes Set korrekt, eigene Übung vorhanden,
      Einstellungen plausibel.
- [ ] Danach eine Lektion normal weiterlernen - kein Folgefehler.

Ergebnis dokumentieren (auch Teilfehler einzeln). Bei JEDEM Abweichen:
Screenshot + welcher Schritt, daraus wird ein Issue mit Forensik.

#### A2. Mobile Scroll-to-Error (#2039, Visual-Device-Check vor Merge)

- [ ] Formular mit Validierungsfehler ausserhalb des Viewports provozieren
      (langes Formular, Fehler oben, Abschicken von unten).
- [ ] Erwartet: automatischer Scroll zum ersten Fehlerfeld, Fehler sichtbar
      und fokussiert.
- [ ] Einmal Hochformat, einmal mit eingeblendeter Tastatur.

#### A3. Rueckstands-Issues iOS

- [ ] Die offenen iOS-Verifikationspunkte aus dem Tracker in derselben
      Session abarbeiten (Liste aus den jeweiligen Issues, jeweils Ergebnis
      als Issue-Kommentar).

#### A3b. Einstieg für Wiederkehrer bleibt nie leer (#2573)

Robustheit beim Nachladen auf iOS - der Einstieg darf nie einen leeren
Inhaltsbereich unter intakter Kopf-/Navigationsleiste hinterlassen:

- [ ] Als WIEDERKEHRENDER Nutzer (Daten vorhanden) die App-URL frisch öffnen
      (z. B. einen geteilten QR-Code der App-URL scannen). Erwartet: du
      landest auf dem Dashboard - nie ein komplett leerer Inhaltsbereich
      zwischen Kopfzeile und unterer Navigationsleiste.
- [ ] Während eine Ansicht lädt, erscheint eine sichtbare Ladeanzeige
      (Spinner + „Lädt ..."), nie ein leerer Kasten.
- [ ] Fehlerfall erzwingen: Gerät offline / drosseln, sodass eine Lazy-Ansicht
      nicht laden kann, dann eine Route öffnen. Erwartet: nach kurzer
      Wartezeit eine lesbare Meldung („Das dauert länger als erwartet." bzw.
      „Diese Ansicht ließ sich nicht laden.") mit „Neu laden"-Knopf - kein
      stiller Leerbildschirm.

#### A4. Lektion löschen (#2064, gemerged) - überschneidet sich mit A1

Dieses Feature verlangt laut Testplan beide Speichermodi plus
Backup-Round-Trip inklusive iOS-Standalone. Das ist in der Substanz
derselbe Ablauf wie A1. Beides in einem Durchgang erledigen (siehe auch
den Abschnitt "Einzelne Lektion löschen (#2064)" weiter unten):

- [ ] In "Meine Inhalte" eine Lektion mit vorhandenem Lernfortschritt
      löschen.
- [ ] Bestätigungsdialog prüfen: Nennt er den Lernfortschritt (gelernte
      Karten), nicht nur die Uebungszahl?
- [ ] Nach dem Löschen: Lektion weg, keine verwaisten Karten in der
      Wiederholung, Favorit entfernt, Nummerierung mit Luecke wie
      entschieden.
- [ ] Backup von VOR dem Löschen importieren: Lektion kommt zurück (Backup
      ist ein Zeitpunkt, so entschieden). Das ist erwartetes Verhalten, kein
      Fehler.
- [ ] Beide Speichermodi.

#### A5. Wizard-Schritt-Reset (#2061, gemerged) - kurz, auch am Desktop möglich

- [ ] Buch-Set öffnen, "Lektion bearbeiten", zu Schritt 2 navigieren.
- [ ] Im Dropdown ein anderes Kapitel wählen: Schritt 2 bleibt, Übungen der
      neuen Lektion erscheinen.
- [ ] Randfälle: Wechsel zu einer Lektion ohne Übungen, Rückwärtswechsel.

#### A6. Lektionsreihenfolge verschieben (#2172, gemerged)

Die Anzeigereihenfolge ist ein eigenes Feld; Verschieben ändert die
Sortierung, nie die Identität einer Lektion. iOS-Standalone ist der heiklere
Fall (Verschieben auf dem Telefon).

- [ ] In "Meine Inhalte" ein mehrlektionales (Buch-)Set aufklappen ->
      "Lektionen verwalten".
- [ ] Je Lektion sind Auf/Ab-Bedienelemente sichtbar. Beim ersten Eintrag ist
      "Auf" deaktiviert, beim letzten "Ab" deaktiviert (kein wirkungsloses
      Klicken).
- [ ] Nur mit der Tastatur bedienbar: mit Tab zum Auf/Ab-Element, mit
      Leertaste/Enter auslösen. Der Screenreader liest eine verstaendliche
      Bezeichnung ("Lektion X nach oben verschieben") und nach dem Verschieben
      die neue Position ("X ist jetzt an Position n von m").
- [ ] Reihenfolge ist SOFORT gespeichert - keine gesonderte Speichern-Aktion.
      Seite neu laden (oder Set zu- und wieder aufklappen): die geänderte
      Reihenfolge bleibt.
- [ ] Wirkt auf die LERNFOLGE (#2212), nicht nur die Liste: nach dem
      Verschieben öffnet das Set mit der neuen ersten Lektion, und die
      Weiter-Navigation ("nächste Lektion") folgt der gewählten Reihenfolge -
      in beiden Speichermodi.
- [ ] Bestehende Sets: ohne eigenes Verschieben zeigt sich die bisherige
      Reihenfolge unverändert (kein stilles Umsortieren).
- [ ] Identität unberührt: nach mehreren Verschiebungen einer Lektion mit
      vorhandenem Lernfortschritt bleibt der Fortschritt zugeordnet, keine
      verwaisten Wiederholungskarten, Löschen trifft weiter die richtige
      Lektion.
- [ ] Backup-Round-Trip: Export -> Speicher leeren -> Import bringt die
      gewählte Reihenfolge zurück.
- [ ] Beide Speichermodi (API + Dexie).
- [ ] iOS-Standalone (PWA vom Home-Bildschirm): Verschieben per Touch und die
      Positions-Rückmeldung funktionieren, Reihenfolge bleibt nach dem
      Schliessen und Wiederoeffnen.

#### A6b. Importreihenfolge folgt der Quelle (#2173, gemerged)

Nach einem Buch-/Text-Import stehen die Lektionen in Quell-/Kapitelreihenfolge,
nicht alphabetisch nach Titel (früher: Epilog vor Kapitel 1). Die Reihenfolge
wird beim Import in denselben Overlay-Speicher wie das Verschieben (#2172)
geschrieben; Dateinamen/Identitäten bleiben unberührt. Der heikle Fall ist
die Herkunft: eine eigene Verschiebung des Nutzers darf ein erneuter Import
NICHT überschreiben.

- [ ] Ein Buch mit Kapiteln importieren, deren Titel alphabetisch NICHT der
      Kapitelfolge entsprechen (z. B. ein "Epilog" oder "Anhang"). Nach dem
      Import zeigt "Lektionen verwalten" die Kapitel in Buchreihenfolge, nicht
      alphabetisch.
- [ ] Wirkt auf die LERNFOLGE, nicht nur die Liste: das Set öffnet mit der
      ersten Quell-Lektion, die Weiter-Navigation folgt der Quellreihenfolge -
      in beiden Speichermodi (API + Dexie).
- [ ] Identität unberührt: Lernfortschritt/Wiederholungskarten bleiben
      zugeordnet (keine Umnummerierung der Dateinamen).
- [ ] Nutzer gewinnt: eine Lektion von Hand verschieben, dann dasselbe Buch
      erneut importieren (bzw. Inhalt aktualisieren). Die eigene Reihenfolge
      bleibt erhalten, wird NICHT still zurückgesetzt.
- [ ] Neue Lektionen bei erneutem Import nach eigenem Verschieben landen am
      Ende (sichtbar, nicht eingestreut); entfernte Lektionen verschwinden,
      die übrige gewählte Reihenfolge bleibt.
- [ ] Bestehende (vor #2173 importierte) Sets werden nicht automatisch
      umsortiert; der Nutzer zieht sie über "Lektionen verwalten" (#2172)
      gerade.
- [ ] Backup-Round-Trip: Export -> Speicher leeren -> Import bringt die
      Reihenfolge zurück.
- [ ] iOS-Standalone (PWA vom Home-Bildschirm): frisch importiertes Buch in der
      installierten PWA öffnen - die Kapitel stehen in Buchreihenfolge, und
      eine eigene Verschiebung überlebt ein Schliessen und Wiederoeffnen.

#### A6c. Downloadreihenfolge folgt dem Manifest (#2367)

Heruntergeladene Sets (Registry/Quellen-Browser) zeigen die Lektionen in der
im Set-Manifest deklarierten Reihenfolge (metadata.lessons), nicht mehr
alphabetisch nach Dateinamen. Der heikle Fall sind gemischte zwei- und
dreistellige Präfixe: alphabetisch sortiert 100- zwischen 10- und 11-. Gilt
an beiden Nähten: Dexie-Download (Overlay-Seed wie beim Import, #2173) und
API-Modus (Backend-Listung folgt dem Manifest).

- [ ] Ein Set mit gemischten Präfixen herunterladen (z. B.
      alc-psychology psych-intro, 01- bis 112-). "Lektionen verwalten" zeigt
      die Lektionen in Manifestreihenfolge: 99- vor 100-.
- [ ] Wirkt auf die LERNFOLGE: das Set öffnet mit der ersten Lektion laut
      Manifest, "nächste Lektion" folgt der Manifestfolge - in beiden
      Speichermodi (API + Dexie).
- [ ] Nutzer gewinnt: eine Lektion von Hand verschieben, dann das Set erneut
      herunterladen / aktualisieren. Die eigene Reihenfolge bleibt.
- [ ] Sets ohne metadata.lessons im Manifest verhalten sich unverändert
      (alphabetische Reihenfolge, kein stilles Umsortieren).

#### A7. Bearbeiten je Lektion, nicht je Set (#2210)

Bearbeiten gehört an die Lektion, nicht an das Set. Der Set-Knopf riet
früher, welche Lektion gemeint ist, und öffnete immer die erste. Drei
gleichartige Zeilen-Knöpfe (Abspielen/Bearbeiten/Löschen) brauchen
unterscheidbare, titelbezogene Bezeichnungen. iOS-Standalone ist der heiklere
Fall (drei plus Auf/Ab je Zeile auf dem Telefon).

- [ ] In "Meine Inhalte" ein mehrlektionales (Buch-)Set aufklappen ->
      "Lektionen verwalten". Je Lektion sind jetzt Abspielen, Bearbeiten und
      Löschen sichtbar (zusätzlich zu Auf/Ab).
- [ ] Bei einem Set mit MEHREREN Lektionen gibt es KEINEN Bearbeiten-Knopf
      mehr auf Set-Ebene (er würde nur raten).
- [ ] Bei einem Set mit EINER Lektion bleibt der Bearbeiten-Knopf auf
      Set-Ebene (eindeutig = diese eine Lektion).
- [ ] Bearbeiten der ZWEITEN oder dritten Lektion öffnet genau DIESE Lektion
      im Editor (nicht die erste). Nach dem Verschieben trifft Bearbeiten
      weiterhin die richtige Lektion (Identität, nicht Position).
- [ ] Nur mit der Tastatur bedienbar: mit Tab zu Abspielen/Bearbeiten/Löschen,
      mit Leertaste/Enter auslösen. Der Screenreader liest je Knopf eine
      unterscheidbare Bezeichnung mit Lektionstitel ("Lektion X bearbeiten"),
      keine drei gleich klingenden Knöpfe.
- [ ] Beide Speichermodi (API + Dexie).
- [ ] iOS-Standalone (PWA vom Home-Bildschirm): alle Zeilen-Knöpfe sind mit
      dem Finger sicher und ohne Fehlgriff bedienbar; Bearbeiten öffnet die
      richtige Lektion.

### Session B: Ubuntu (Launcher-Binary, nach der Launcher-Session)

Voraussetzung: die v2.8.2-Release-Binaries (der Launcher ist seit v2.8.0 im
IMAGE-Modus, #2167; Engine-Pin docker-app-launcher ^0.25.1). Nur diese
Binaries verwenden, alle aelteren sind obsolet.

- [ ] Daemon läuft + Testnutzer OHNE docker-Gruppe (qatest):
      Permission-Meldung + pkexec-Fix-Angebot, NICHT "Docker starten". [seit
      dem 0.16.0-Fehlschlag ohne realen Beweis]
- [ ] pkexec-Fix ausführen, echte Neuanmeldung: Zustand wechselt zu "Docker
      läuft".
- [ ] Konsole sichtbar, Detection-Zeilen streamen, Text-Wrap korrekt, Fenster
      resizable.
- [ ] Branding "Adaptive Learner", About: App 2.8.2 mit Quellen-Label; die
      angezeigte Launcher-Version notieren (Ist-Wert aus dem v2.8.2-Binary).
- [ ] Setup läuft durch bis zum erreichbaren App-Frontend im Browser.
      Beweisziel (Image-Modus): anonymer Pull von
      ghcr.io/astrapi69/adaptive-learner:2.8.2 und Start - KEIN Build, kein
      buildx, kein Compose; Pull-Fortschritt sichtbar in der Konsole.
- [ ] Zweitstart bei laufendem Launcher: fokussiert das bestehende Fenster
      (#31).
- [ ] Stoppen, erneut starten, deinstallieren: keine Fehler, Konsole meldet
      nachvollziehbar.
- [ ] Portwechsel: nach den drei #2069-Faellen unter "PRIO 2 -> Portwechsel:
      Datenmitnahme" testen (der fruehere Vorbehalt ist geliefert).

### Reihenfolge-Empfehlung

Session A zuerst und in einem Durchgang: A1 und A4 teilen sich den
Backup-Round-Trip, A2 und A5 sind kurze Zusatzprüfungen. Damit fällt in
einer Sitzung das aelteste Launch-Gate zusammen mit zwei frisch gemergten
Features. Session B erst, wenn die neuen Binaries vorliegen.

---

## PRIO 1: BACKUP-AKZEPTANZTEST (Launch-Gate!)

**Neuer Testfall unter PRIO 1 Backup-Akzeptanztest:**
- [ ] GitHub Pages: Backup erstellen
- [ ] Lokal installieren (Launcher)
- [ ] .alb von GH Pages importieren → alles übernommen

Dieser Test ist seit Session 2 als Launch-Gate definiert.
Noch nie durchgefuehrt. JETZT machen.

- [ ] Daten erzeugen: mindestens 2 Sets herunterladen, 3 Lektionen starten, Theme wechseln
- [ ] Export: Settings → Daten → Backup erstellen → .alb Datei herunterladen
- [ ] Dateigrösse prüfen (sollte >1MB sein wenn Sets geladen)
- [ ] Browser-Daten KOMPLETT löschen:
      DevTools → Application → Storage → "Clear site data"
      UND: IndexedDB "adaptive-learner" löschen
      UND: localStorage.clear()
- [ ] App öffnen → Onboarding → "Backup wiederherstellen"
- [ ] .alb Datei auswählen → Import startet
- [ ] KEIN HTTP 413 Fehler (nginx 50MB Limit gefixt)
- [ ] Sets vorhanden (Meine Inhalte → alle zuvor geladenen Sets)
- [ ] Fortschritt erhalten (gestartete Lektionen, Scores)
- [ ] Settings korrekt (Theme, Sprache, Voice-Einstellungen)
- [ ] Lern-Modi Einstellungen erhalten
- [ ] XP + Level korrekt
- [ ] Legacy .json Import: altes Backup-Format → funktioniert
- [ ] API-Keys NICHT im Backup (Sicherheits-Check)
- [ ] Nach Restore: Provider-Übersicht (Settings → KI) zeigt wieder-
      hergestellte Einstellungen OHNE Reload (settings-refresh-bus, #1769)

---

## PRIO 2: LAUNCHER (Desktop)

### Grundfunktion (Ubuntu)
- [ ] `python3 -m adaptive_learner_launcher --debug` → EIN Fenster öffnet
- [ ] Fenster verschwindet NIE von selbst
- [ ] Docker-Check als erster Schritt (Hinweis wenn Docker nicht läuft)
- [ ] Live-Fortschritt bei Install im Log-Bereich (Zeile für Zeile)
- [ ] "Image bauen..." sichtbar (nicht stiller Hintergrund)
- [ ] Am Ende: "App ist bereit." in grün

### Port
- [ ] Port-Feld sichtbar (Default 8501)
- [ ] Port editierbar wenn gestoppt/nicht installiert
- [ ] Port read-only wenn läuft
- [ ] Port WECHSELN: 8501 → 9000 → App erreichbar auf 9000
- [ ] Port-Indikator: grün wenn läuft (nicht rot)

### Portwechsel: Datenmitnahme (#2069)
- [ ] Servermodus (Default): Daten anlegen, Port wechseln, neu öffnen → Sets + Fortschritt weiter da (Backend-Daten überleben; auf der Landing-Seite via identity.yaml automatisch wiederhergestellt)
- [ ] Browser-Speichermodus (Einstellungen > Daten > Speichermodus): Daten anlegen, Port wechseln, neu öffnen → leere App mit Hinweis "Hast du Adaptive Learner schon einmal unter einem anderen Port genutzt?" auf dem Willkommensbildschirm (Daten NICHT gelöscht, nur an den alten Origin gebunden)
- [ ] Der Hinweis verlinkt auf die Hilfeseite "Den Port ändern"
- [ ] Wiederherstellung (Browser-Modus): zurück zum alten Port → Einstellungen > Daten > Backup exportieren (`.alb`) → neuer Port → "Aus Backup wiederherstellen" → Sets, Fortschritt, Übungen, Einstellungen wieder da
- [ ] Kanonische Web-Version (astrapi69.github.io, Browser-Modus, kein expliziter Port): der Hinweis erscheint NICHT

### Zustaende
- [ ] Nicht installiert: [Installieren] sichtbar
- [ ] Läuft: [Im Browser öffnen] [Stoppen] [Deinstallieren]
- [ ] Gestoppt: [Starten] [Deinstallieren]
- [ ] Alle Buttons komplett sichtbar (620px breit, kein Abschneiden)

### Deinstallieren
- [ ] Verbose Output: jeden Container/Image einzeln mit ✓/✗
- [ ] Image-Groessen angezeigt
- [ ] Summary: "X Artefakte entfernt, Y MB freigegeben"
- [ ] Zustand wechselt zu "Nicht installiert"

### Cleanup beim Start
- [ ] Findet verwaiste Artefakte (falls vorhanden)
- [ ] User kann auswählen (Lerndaten default AUS)
- [ ] Verbose Fortschritt

### Windows
- [ ] .exe startet (aus GitHub Release)
- [ ] Persistentes Fenster (KEINE Dialog-Kette!)
- [ ] Alle Funktionen wie auf Linux

---

## PRIO 3: CONTENT-QUALITAET (Native-Speaker Stichprobe)

Erfordert Domaenenwissen. Nicht automatisierbar.

- [ ] Deutsch-Englisch A1/B1: Übersetzungen korrekt?
- [ ] KI-Einsteiger (DE): Fachbegriffe korrekt? Erklärungen verständlich?
- [ ] Ansible QE: Kommandos korrekt? Syntax stimmt?
- [ ] Japanisch A1: Hiragana/Katakana korrekt? Romanisierung stimmt?
- [ ] Koreanisch A1: Hangul korrekt? Romanisierung stimmt?
- [ ] Chinesisch A1: Pinyin korrekt? Zeichen stimmt?
- [ ] Italienisch A1: Stichprobe Grammatik/Vokabeln
- [ ] Portugiesisch-BR A1: Stichprobe
- [ ] KI-generierte Fehlerkorrektur (#2355/#2364): bei einer generierten
      `ext:al-error-correction`-Aufgabe prüfen, ob der markierte Token wirklich
      der falsche ist und die akzeptierte Korrektur ihn sinnvoll ersetzt.
      Schemakonform ist nicht gleich sinnvoll: ein bereits richtiger markierter
      Token ist gültig, aber keine echte Aufgabe, und keine Automatik kann das
      erkennen (nur diese Stichprobe). Sinngemäß gilt dasselbe fürs benotete
      Quiz und das Leseverständnis - lösbar, eindeutig, Bewertung wie erwartet

---

## PRIO 4: LERNEN - MANUELLE UX-PRUEFUNG

### Übungstypen (visuell prüfen)
- [ ] Matching: Paare GLEICHE Höhe (kein visueller Versatz)
- [ ] Matching: "Aufloesen" Animation sieht gut aus (4 Effekte testen)
- [ ] Word Tiles: Korrektur LESBAR (Leerzeichen, kein "DasGehirnvergisst...")
- [ ] Word Tiles: bei RICHTIGER Lösung bleibt der gebaute Satz sichtbar (#2494):
      einen Satz korrekt zusammensetzen und prüfen. Der zusammengesetzte Satz
      wird danach weiterhin (grün) angezeigt und verschwindet NICHT; darunter
      erscheinen die Erfolgsmeldung ("Richtig!") und der Weiter-Knopf. iOS PWA/
      Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm hinzugefügten
      Web-App-Icon durchführen.
- [ ] Free Text: Korrektur LESBAR (Token-Diff verständlich)
- [ ] Picture Choice: Kacheln GLEICHE Höhe
- [ ] Antwort-Reihenfolge gemischt (#2317): eine Bildauswahl (picture_choice)
      mehrfach in verschiedenen Lektionen öffnen - die richtige Kachel steht
      NICHT immer an derselben Stelle (früher durchgängig die erste). Innerhalb
      EINER Sitzung bleibt die Reihenfolge stabil (kein Springen beim erneuten
      Ansehen derselben Übung). Ein richtiger Fingertipp wird weiterhin als
      richtig, ein falscher als falsch gewertet (Bewertung + Wiederholungs-
      fortschritt inhaltsbasiert, nicht positionsbasiert). Gleiches gilt für die
      Optionen in ext:al-graded-quiz und ext:al-reading-comprehension.
      iOS PWA/Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm
      hinzugefügten Web-App-Icon durchführen.
- [ ] Zuordnung + Wort-Kacheln gemischt (#2371, #2372): eine Zuordnungsübung
      mehrfach öffnen (verschiedene Übungen/Besuche) - das erste Element links
      gehört NICHT durchgängig zum letzten rechts (früher praktisch immer
      umgekehrte Reihenfolge); beide Spalten erscheinen unabhängig gemischt.
      Bei Wort-Kacheln steht das erste Lösungswort NICHT durchgängig hinten in
      der Kachelleiste. Innerhalb EINER Übungsansicht bleibt die Reihenfolge
      stabil. Richtige Paare/Sätze werden weiterhin richtig gewertet (Bewertung
      inhaltsbasiert, nicht positionsbasiert). iOS PWA/Standalone: dieselbe
      Prüfung auf dem zum Home-Bildschirm hinzugefügten Web-App-Icon
      durchführen.
- [ ] Zuordnung: KEIN Tipp-Knopf (#2443, ersetzt #2390): eine Zuordnungsübung
      öffnen. Über den Spalten erscheint KEIN "Tipp anzeigen"-Knopf, und es wird
      dafür KEIN XP abgezogen. Grund: bei Zuordnung stehen alle Wörter beider
      Spalten vollständig auf dem Bildschirm, ein Anfangsbuchstaben-Hinweis
      verrät nichts. Bei Freitext/Cloze/Wort-Kacheln bleibt der Tipp-Knopf wie
      bisher erhalten. iOS PWA/Standalone: dieselbe Prüfung auf dem zum
      Home-Bildschirm hinzugefügten Web-App-Icon durchführen.
- [ ] Zuordnung: kein falscher Untertitel/Spaltentitel bei Wissens-Sets (#2392):
      eine Zuordnungsübung eines WISSENS-Sets öffnen (nicht-sprachliche Domäne
      oder Quell- = Zielsprache, z. B. Sinne zu Organen). Es erscheint KEIN
      Untertitel „Ordne jeden Begriff seiner Definition zu"; die Spalten tragen
      KEINE Beschriftung „Begriff"/„Definition" mehr, nur noch die Badges „A"/
      „B" und ihren Inhalt. Bei einer echten SPRACH-Übung bleibt alles wie zuvor
      (Sprachnamen bzw. Term/Übersetzung + Richtungshinweis sichtbar). iOS PWA/
      Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm hinzugefügten
      Web-App-Icon durchführen.
- [ ] Zuordnung: Vorspann frisst den Bildschirm nicht mehr (#2391/#2444/#2453): eine
      Zuordnungsübung auf einem KLEINEN Gerät (iPhone) öffnen. Der Knopf „Wie
      funktioniert das?" sitzt OBEN in der Knopfzeile unter dem Titel, direkt
      neben „Theorie nochmal lesen" (#2453) — sofern diesem Schritt eine Theorie
      vorangeht. Ohne vorangehende Theorie fehlt „Theorie nochmal lesen", und
      „Wie funktioniert das?" steht allein in derselben Zeile (gleiche Position).
      Er sitzt NICHT mehr auf der Anweisungszeile („Paare verbinden …", #2453
      korrigiert #2444). Auf 375px passt er ohne hässlichen Umbruch.
      Die Bedienanleitung („Wähle links …") und der „A → B"-Hinweis liegen
      HINTER diesem Knopf (zugeklappt beim Öffnen; antippen klappt auf/zu); beim
      Aufklappen bricht der Inhalt sauber auf die nächste Zeile in voller Breite
      um. Der Fortschrittszähler („2 / 5 zugeordnet") steht OBEN bei der
      Aufgabenstellung (nicht mehr unten neben „Antworten prüfen"), damit er
      während des Zuordnens sichtbar ist; nach dem Prüfen verschwindet er und die
      Punktzahl erscheint unten (#2445). Die zweite Spalte ist ohne langes
      Scrollen erreichbar.
      Barrierefreiheit: der Knopf ist per Tastatur bedienbar und der Inhalt für
      Screenreader auch zugeklappt erreichbar (natives <details>). iOS PWA/
      Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm hinzugefügten
      Web-App-Icon durchführen.
- [ ] Schwierigkeits-Indikator (#1693): eine Übung, deren Karte(n) eine
      authored `difficulty` (1-5) tragen, zeigt über der Übung ein kleines
      Badge mit Stufenwort (Leicht/Mittel/Schwer) + 5-Punkt-Anzeige.
      Karten OHNE `difficulty` (der gesamte Alt-Bestand) zeigen KEIN Badge
      (die Übung sieht aus wie vorher). Gilt für alle Übungstypen
      (Matching/Cloze/Free-Text/Word-Tiles/Picture-Choice/Multiple-Choice
      + ext-Typen). Badge liest in allen 6 Themes sauber (Token-basiert).
      Nur Transparenz - beeinflusst weder Reihenfolge noch Bewertung.

### Testmodus (Vorschau-Build, #2319)

Nur relevant, wenn der Build mit `VITE_TEST_MODE=true` gebaut wurde (Vorschau-
Auslieferung). Im regulären Build ist der Modus nicht vorhanden.

- [ ] Aktivieren per versteckter Geste: sechs schnelle Tipps auf die
      Fortschrittsanzeige oben in einer laufenden Lektion. Danach erscheint das
      Testmodus-Banner ("Antworten werden nicht bewertet, kein Fortschritt wird
      gespeichert").
- [ ] Nicht versehentlich auslösbar: einzelne oder langsame Tipps auf die
      Fortschrittsanzeige aktivieren den Modus NICHT.
- [ ] Jede Antwort gilt als richtig: eine bewusst FALSCHE Wahl/Eingabe (Auswahl,
      Freitext, Zuordnung) wird als richtig angezeigt, die Lektion lässt sich
      komplett durchklicken, ohne die Inhalte zu kennen.
- [ ] Kein Fortschritt: nach dem Durchklicken im Testmodus zeigt die Lektion
      KEINEN Fortschritt, es entstehen keine Wiederholungskarten und keine
      Fehlerzähler (Dashboard/Wiederholung prüfen).
- [ ] Beenden: "Testmodus beenden" im Banner schaltet zurück; das Verlassen der
      Lektion setzt den Modus zurück (erneutes Betreten startet ohne Testmodus).
- [ ] iOS PWA/Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm
      hinzugefügten Web-App-Icon (Geste per Fingertipp, Banner sichtbar,
      Durchklicken möglich).

### Lern-Modi (jeden einmal durchspielen)
- [ ] Modus-Toggle im aufklappbaren Options-Panel erreichbar (seit #1628
      hinter dem Panel, nicht mehr direkt sichtbar)
- [ ] "Optionen"-Button steht in DERSELBEN Zeile wie die Fortschritts-
      anzeige ("Schritt n von m"), nicht darunter (Desktop: Balken links,
      Button rechts daneben; Mobile: eng gepackt bzw. sauberer Umbruch,
      kein Ueberlappen) (#1942)
- [ ] Pruefungsmodus: keine Hilfen, Ergebnis am Ende, 1.5x XP
- [ ] Zeitmodus: Countdown-Balken sichtbar, Farb-Uebergang
- [ ] Fehler-Modus: nur Fehlerkarten (nach min. 1 Fehler)
- [ ] Rueckwaerts: Matching-Spalten getauscht
- [ ] Zufall: Karten aus verschiedenen Lektionen gemischt
- [ ] Endlos: kein Session-Ende, Statistik läuft
- [ ] Endlos-Abschluss ("Übung beendet"): Enter (ohne Klick) löst
      "Zurück zum Dashboard" aus (#1864, Button auto-fokussiert)
- [ ] Fehler-wiederholen-Abschluss ("Alle Fehler korrigiert!"): Enter
      (ohne Klick) löst "Zurück zur Lektion" aus (#1864); Klick auf den
      Button funktioniert weiterhin
- [ ] Lektions-Zusammenfassung ("Geschafft: ..."): mit verfuegbarer
      nächster Lektion löst Enter (ohne Klick) die primäre Karte
      "Nächste Lektion -> Starten" aus - nicht eine sekundäre Karte
      (z. B. "Wiederholung"); Klick auf die Buttons funktioniert weiterhin
      (#1943)
- [ ] Letzte Lektion eines Sets (keine "Nächste Lektion"): auf der
      Zusammenfassung passiert bei Enter nichts Falsches - kein Fehler,
      keine Navigation zu einer nicht vorhandenen Lektion (#1943)
- [ ] Fehler wiederholen bei Zuordnung (#1874): Zuordnungs-Übung mit
      gemischt richtigen/falschen Paaren spielen, "Fehler wiederholen"
      öffnen -> nur die falschen Paare erscheinen (nicht alle). Bei nur
      einem falschen Paar werden korrekte Paare als Distraktoren aufgefuellt
      (mind. 2 Paare, damit überhaupt zugeordnet werden kann)
- [ ] Einstellung "Fehler wiederholen" (Settings -> Lernen): Umschalten auf
      "Ganzes Set wiederholen" -> beim nächsten "Fehler wiederholen"
      erscheinen tatsächlich ALLE Paare; zurück auf "Nur Fehler zeigen"
      (Standard) -> wieder nur die falschen
- [ ] Regression andere Typen: Freitext/Lueckentext bei "Fehler
      wiederholen" weiterhin nur die falschen Elemente

### Zusammenfassung zählt Korrekturen mit (#2479)
- [ ] Eine Lektion mit mehreren falschen Antworten spielen, dann in der
      Korrektur-Runde am Ende die Fehler beheben. Der Punktzahl-Balken zeigt
      zwei Abschnitte: was auf Anhieb saß (voll gefüllt) und was nach Korrektur
      dazukam (schraffiert), mit Legende "N auf Anhieb" / "N nach Korrektur".
- [ ] Sterne, Botschaft und die "+N XP" richten sich nach dem Endstand: wer alle
      Fehler behebt, bekommt volle Sterne und "Volle Punktzahl!", nicht mehr
      "1 von 3 Sternen" / "Guter Anfang". Die gutgeschriebene XP entspricht der
      angezeigten Zahl.
- [ ] Ohne Korrektur-Runde bleibt der Balken einfarbig (kein leerer zweiter
      Abschnitt, keine Legende), Sterne + Botschaft wie gehabt.
- [ ] Prüfungsmodus (Exam): Der Endstand richtet sich NICHT nach der Korrektur
      - ein Prüfungsergebnis ist der erste Durchgang (Balken einfarbig, Sterne
      + XP unverändert).
- [ ] Barrierefreiheit: Die beiden Balkenabschnitte sind auch ohne Farbe
      unterscheidbar (Schraffur + Legende) - in hellem UND dunklem Design
      prüfen.
- [ ] iOS PWA/Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm
      hinzugefügten Symbol (der Befund kam von dort). Balken, Sterne, Botschaft
      und XP zeigen den Endstand nach der Korrektur.

### Ein Fehler-Bereich, zugeklappt (#2496)
- [ ] Eine Lektion mit mindestens einem Fehler spielen. Auf der
      Zusammenfassung erscheint der Bereich "Fehler ausbessern (N)"
      ZUGEKLAPPT: KEIN Textfeld hat den Fokus, es poppt KEINE Tastatur auf
      (auf dem Handy prüfen - das war der Befund). Die Punktzahl bleibt sichtbar.
- [ ] Auf "Jetzt ausbessern" tippen -> der Bereich klappt auf, die erste
      Korrektur-Übung (Lückentext) erscheint und bekommt JETZT den Fokus
      (Tastatur darf jetzt aufgehen - bewusste Aktion des Nutzers).
- [ ] Innerhalb des aufgeklappten Bereichs gibt es die sekundäre Aktion
      "Alle Übungen erneut (N)" -> führt auf die Fehler-wiederholen-Seite
      mit den echten fehlgeschlagenen Übungen.
- [ ] In den "Nächste Schritte"-Karten gibt es KEINE eigene
      "Fehler wiederholen"-Karte mehr (in den einen Bereich zusammengeführt).
      Enter aktiviert weiterhin die primäre Vorwärts-Karte (Nächste Lektion /
      Adaptiv / Wiederholung), nie den zugeklappten Fehler-Bereich.
- [ ] Sind bereits alle Fehler korrigiert, zeigt der Bereich eine kurze
      Erfolgsmeldung ("Alle Fehler korrigiert!") statt einer Übung.
- [ ] #2570: Nur nicht-lückentext-fähige Fehler (kein Cloze generierbar) - der
      Bereich zeigt DIREKT "Wiederhole deine Fehler" mit dem Hinweis "Das lässt
      sich nicht als Schnellübung anzeigen - wiederhole stattdessen die
      Übungen." + dem Button "Alle Übungen erneut (N)". KEIN "Jetzt
      ausbessern"-Zwischenschritt mehr, der nur ins Leere aufklappen würde.
- [ ] #2570 Platzierung: der Fehler-Bereich steht in der Standard-Reihenfolge
      VOR den "Nächste Schritte"-Karten (Nächste Lektion / Adaptiv / ...), nicht
      danach - erst die eigenen Fehler ausbessern, dann entscheiden wie es
      weitergeht. Bleibt über Settings weiterhin frei umsortierbar.

### Neue Übungstypen (seit v2.2.0, visuell + funktional)
- [ ] multiple_choice: Auswahl, Feedback, SRS-Attempt
- [ ] ext:al-categorization: Kategorien zuordnen, Auflösung lesbar
- [ ] ext:al-error-correction: Fehler finden + korrigieren
- [ ] ext:al-reading-comprehension: Text + Fragen
- [ ] ext:al-graded-quiz: Bewertung + Ergebnisanzeige
- [ ] ext:al-dictation (#1881): "Listen first" spielt den Clip, Transkription
      tippen; richtig / knapp daneben ("Almost!") / falsch zeigt die Lösung;
      eine Lektion mit `requires_extensions: ["ext:al-dictation@1"]` laedt
      (wird nicht vom Guard abgelehnt)
- [ ] ext:al-image-description (#2095): das Bild wird gezeigt, eine
      Freitext-Beschreibung tippen; richtig / knapp daneben ("Almost!") /
      falsch zeigt die Lösung; eine Lektion mit
      `requires_extensions: ["ext:al-image-description@1"]` laedt (nicht vom
      Guard abgelehnt). Ein eingebettetes Bild wird OHNE Netzverbindung
      angezeigt (Offline-First); eine Lektion mit einer entfernten
      `http(s)://`-Bild-URL wird vom Guard abgelehnt. Vorlesen: der Prompt hat
      einen Lautsprecher-Button (die Anweisung wird vorgelesen, nie die
      Antwort). a11y-Hinweis: dieser Typ ist bewusst visuell voraussetzungs-
      behaftet (die Antwort IST die Bildbeschreibung) - ein Screenreader hört
      ein neutrales Bild-Label, nicht die Lösung.
- [ ] Listen-First-Audio (#1687): Audio-Button auf free_text +
      matching spielt ab, Grading unbeeinflusst

### Set erneut durcharbeiten - zweiter Durchgang (#2125, EXP-051)

Ort: Meine Inhalte (`/content?tab=my`), Drei-Punkte-Menü eines Sets im
Status **Abgeschlossen**. Ein neuer Durchgang hebt den ersten für die
spätere Auswertung auf, statt ihn zu überschreiben oder zurückzusetzen.

- [ ] Ein Set als **Abgeschlossen** markieren -> im Drei-Punkte-Menü
      erscheint **"Erneut durcharbeiten"** (bei aktiven/zurückgestellten
      Sets NICHT vorhanden)
- [ ] Klick -> **einfache** Bestätigung ("Ein neuer Durchgang beginnt von
      vorne, der vorherige bleibt erhalten"), OHNE gezählte Löschmengen
- [ ] Bestätigen -> Toast "Ein neuer Durchgang wurde gestartet …", das Set
      steht wieder auf **Aktiv**, KEINE Fehlermeldung, kein Datenverlust
- [ ] Abbrechen -> nichts passiert, Status bleibt Abgeschlossen
- [ ] Nach dem Neustart eine zuvor gelernte Übung falsch beantworten -> die
      Wiederholungswarteschlange füllt sich **frisch** (kalte Planung; die
      Karten des ersten Durchgangs tauchen NICHT als überfällig auf)
- [ ] Set löschen (mit "Fortschritt löschen") -> ALLE Durchgänge des Sets
      verschwinden, keine verwaisten Zeilen
- [ ] Beides prüfen: Desktop/Server (API-Modus) UND iOS-PWA/GitHub Pages
      (Dexie-Modus) - der Ablauf muss in BEIDEN Modi funktionieren
- [ ] Backup-Rundlauf: Export -> Wipe -> Import; die Durchgänge (inkl. des
      abgeschlossenen ersten) überstehen den Import. Eine ältere Sicherung
      ohne Durchgangsdaten importiert als impliziter Durchgang 1 (kein Crash)

### Import/Export von Lektionen/Sets (#1672 / #1681 / #1685-Haertung)

Ort: Meine Inhalte (`/content?tab=my`) → "Lektion importieren"-Modal +
per-Karte "Exportieren" / "Als Set exportieren"; akzeptiert `.json` (eine
Lektion) + `.zip` (ganzes Set = `manifest.yaml` + `lessons/`).

- [ ] Import einer `.json`-Lektion: Vorschau zeigt Titel · Sprache · N
      Lektionen · M Übungen VOR dem Bestätigen
- [ ] Import eines `.zip`-Sets: Vorschau + korrekte Lektionszahl
- [ ] Namenskollision: Drei-Wege-Dialog erscheint (Überschreiben /
      Als Kopie importieren / Abbrechen), KEIN stilles Überschreiben;
      "Als Kopie" erzeugt neue id + "(Kopie)"-Titel
- [ ] Teil-Import (ZIP mit kaputten Lektionen): gültige importieren,
      Warnung "N Lektion(en) übersprungen" wird angezeigt
- [ ] Set mit NUR kaputten Lektionen: sauberer Fehler, kein Crash
- [ ] Groessen-Guard: Datei > 5 MiB wird VOR dem Parsen freundlich
      abgelehnt; kaputtes JSON/ZIP nennt den Grund, kein Crash
- [ ] Round-Trip: Lektion exportieren → re-importieren → identisch in
      Meine Inhalte
- [ ] Create-Lesson "Als Datei speichern": Speichern-Schritt bietet
      Datei-Download der eben erstellten Lektion (kanonisches JSON)

### Create-Lesson-Wizard (`/create-lesson`, v2.3.0)

- [ ] **Buchtext-Pfad (#1745):** Schritt 1 → Karte "Wissenslektion aus
      Text" (unter der Template-Auswahl) startet einen 3-Schritt-Flow
      (Metadaten → Buchtext → Review); Text einfügen + Generieren → KI
      formuliert Theorie in eigenen Worten + erzeugt Übungen; OHNE
      KI-Key: freundlicher Hinweis, kein Crash; "Weiter" erst nach
      erfolgreicher Generierung
- [ ] **Aufgabentyp-Auswahl im Assistenten (#2510):** Im Buchtext-Schritt
      steht **vor dem Textfeld** (zwischen Datei-/Abschnitts-Fläche und dem
      Lehrbuch-Textfeld, #2522) eine Auswahl "Aufgabentypen"
      mit drei Gruppen: **Standardtypen** (Zuordnung, Freitext, Lückentext,
      Wort-Kacheln, Multiple Choice) sind vorausgewählt; **Erweiterungstypen**
      (Kategorisierung, Fehlerkorrektur, Leseverständnis, Benotetes Quiz) sind
      hinzuwählbar; **"Aus Text nicht erzeugbar"** (Bildauswahl, Bildbeschreibung,
      Diktat) sind ausgegraut/deaktiviert mit einem Satz Begründung ("Aus einem
      Text lassen sich keine Bilder oder Audio erzeugen … im Editor nachträglich
      ergänzbar"). Wer nichts ändert, bekommt das heutige Verhalten. Alles außer
      einem Typ abwählen → der letzte bleibt gewählt und der Hinweis "Mindestens
      ein Aufgabentyp muss gewählt bleiben." erscheint (nicht still). Ein
      hinzugewählter Typ ist beim nächsten Durchlauf noch gewählt (gemerkt).
      Generieren → nur die gewählten Typen entstehen; ein gewählter Typ, der
      aus dem Text nicht entstand, wird namentlich unter "Diese gewählten Typen
      sind aus dem Text nicht entstanden:" gelistet (nicht still weniger).
      **iOS-Standalone (PWA, Dexie-Modus):** die Auswahl kostet wenig Höhe (drei
      kompakte, umbrechende Gruppen), ist antippbar, und die gemerkte Auswahl
      übersteht einen Reload. **Barrierefrei:** die ausgegrauten Felder tragen
      eine Beschriftung + `aria-describedby` auf die Begründung.
- [ ] **Reihenfolge der Typ-Auswahl (#2522):** Die Auswahl steht **oberhalb**
      des Lehrbuch-Textfelds, nicht darunter (erst sehen was erkannt wurde,
      dann Typen wählen, dann Text einfügen). **iOS-Standalone (PWA, kleines
      Gerät):** beim Öffnen des Buchtext-Schritts ist das Textfeld **ohne
      Scrollen** erreichbar - die Auswahl drückt es nicht unter die Falz; wer
      ein Kapitel einfügt, muss danach nicht nach oben scrollen, um die Typen zu
      finden. DOM-Reihenfolge entspricht der sichtbaren (keine Axe-Regression).
- [ ] **Titel-Pflichtfeld im Buchtext-Pfad (#1946):** Schritt 1 OHNE
      Titel → Karte "Wissenslektion aus Text" klicken → bleibt auf
      Schritt 1 mit dem freundlichen Hinweis "Ein Titel ist
      erforderlich." (NICHT der Buchtext-Schritt, NICHT der rohe
      Schema-Fehler beim Speichern); mit Titel → Buchtext-Schritt
      öffnet normal und Speichern gelingt
- [ ] **[MOBILE] Titel-Warnung wird sichtbar gescrollt (#2036):** iPhone /
      schmaler Viewport, Schritt 1 OHNE Titel, nach unten zum Weiter-Button
      scrollen (Titelfeld oben ausserhalb des Sichtbereichs) → Weiter
      drücken: die Ansicht scrollt zum Titelfeld, das Feld erhält den Fokus
      und ist als ungültig markiert (roter Rahmen), der Hinweis "Ein Titel
      ist erforderlich." ist im Sichtbereich (KEIN Dead-End, keine Reaktion
      fehlt). Gilt für alle drei Einstiege: Weiter (Karten-Pfad), Karte
      "Wissenslektion aus Text" (Buch) und Karte "Erweiterungen" (Extension).
      Desktop-Regression: ist das Feld schon sichtbar, gibt es keinen
      Scroll-Sprung
- [ ] **Datei-Upload im Buchtext-Schritt (#1927):** Button "Aus Datei
      laden (EPUB, DOCX, TXT, MD)" über dem Textfeld; EPUB wählen →
      Abschnittsliste erscheint (Checkboxen, Titel + Zeichenzahl);
      Markdown-Datei → Split an Ueberschriften; TXT ohne Ueberschriften
      → ein Abschnitt; kaputte/zu grosse Datei (> 20 MiB) → klare
      Fehlermeldung, kein Crash; Rechte-Hinweis erwähnt Hochladen
- [ ] **DOCX-Upload (#1927, Phase 2b):** Word-Datei mit
      Ueberschrift-Formatvorlagen (auch deutsches Word, "Ueberschrift 1")
      → Kapitel werden erkannt und als Liste angeboten; Word-Datei OHNE
      Formatvorlagen (nur fett formatierte "Ueberschriften") → EIN
      Abschnitt "Gesamtes Dokument", Text landet trotzdem editierbar im
      Feld; kaputte .docx → klare Fehlermeldung, kein Crash
- [ ] **Mehrfachauswahl + Ausschluss-Heuristik + Batch (#1949):** Datei
      mit mehreren Abschnitten INKL. Vorwort/Glossar/Inhaltsverzeichnis
      hochladen → typische Nicht-Lerninhalt-Abschnitte sind
      standardmaessig ABGEWAEHLT, aber weiterhin sichtbar und manuell
      ankreuzbar (Hinweiszeile erklärt es); GENAU EIN Abschnitt gewählt
      → Button "In Textfeld übernehmen" füllt das Textfeld (bei
      vorhandenem Text: Bestätigungsdialog "Ersetzen"), Vorschau sichtbar,
      danach normale Einzel-Generierung (Regression); MEHRERE Abschnitte
      gewählt → Button "N Lektionen generieren" startet die Batch-
      Generierung mit Fortschrittsanzeige ("Lektion 2 von 5 …") →
      eine Lektion pro Abschnitt, Reihenfolge = Dokumentreihenfolge (nicht
      Auswahlreihenfolge); Review zeigt "N Lektion(en)" + Titel-Liste;
      Speichern → ein Set mit N Lektionen; schlägt eine Einzel-Generierung
      fehl, laufen die uebrigen weiter, Zusammenfassung nennt "X von N" +
      die fehlgeschlagenen Abschnitte; ohne AI-Key → Key-Hinweis, kein Batch
- [ ] **KI-Uebungsgenerierung erzeugt Multiple-Choice (#2353):** eine
      Wissenslektion aus Text/Buchtext mit AI-Key generieren, deren Theorie
      klare Faktenfragen mit mehreren Antwortoptionen enthält (z. B. "Welche
      dieser Module gehören zu X?") → in der Vorschau "Generierte Übungen"
      erscheint mindestens gelegentlich ein Chip **"Multiple-Choice"** neben
      Matching/Cloze/Freitext/Wort-Kacheln; die gespeicherte Lektion spielt die
      MC-Übung ab (Einzelauswahl-Radio bzw. "Alle zutreffenden wählen"-
      Checkboxen), Feedback + SRS funktionieren wie bei den anderen Typen.
      Regression: die anderen fünf Typen entstehen weiterhin
- [ ] **KI-Uebungsgenerierung erzeugt Text-Extensions (#2355):** eine
      Buchtext-Lektion mit AI-Key aus einem Sachtext generieren, dessen
      Theorie sich strukturell für Extensions eignet (ein längerer
      Textabschnitt mit mehreren Rueckfragen, Begriffe die sich in Kategorien
      einsortieren lassen, eine Aussage mit einem falschen Wort) → in der
      Vorschau "Generierte Übungen" erscheinen gelegentlich Chips
      **"Leseverständnis" / "Kategorisierung" / "Fehlerkorrektur" /
      "Benotetes Quiz"**; nach dem Speichern LAEDT die Lektion ohne
      "nicht unterstuetzte Extension"-Fehler (die Lektion deklariert
      `requires_extensions`) und die Extension-Übungen spielen sich im
      Lektions-Runner korrekt ab (Passage + Unterfragen, Zuordnung,
      Token-Korrektur, benotetes Quiz mit Bestehensschwelle). WICHTIG:
      höchstens EIN Leseverständnis und EIN benotetes Quiz pro Lektion;
      die Kern-Typen dominieren weiterhin. Regression: eine reine
      Kern-Typen-Lektion deklariert KEINE requires_extensions
- [ ] **Buchpfad bietet keine Bildauswahl mehr an + Set-Typenvielfalt
      (#2356):** ein Mehrfach-Abschnitts-Buchupload (mehrere Lektionen)
      generieren → KEINE der generierten Lektionen enthält eine
      **Bildauswahl**-Übung (im Buchpfad gibt es kein Bildmaterial, der Typ
      wird gar nicht mehr angeboten statt später verworfen); UEBER die
      Lektionen des Sets hinweg entstehen mehr als vier verschiedene
      Aufgabentypen (nicht nur cloze/matching/free_text/word_tiles). Regression:
      der Einzel-Buchpfad und die Set-Uebungsgenerierung erzeugen weiterhin
      gültige Lektionen
- [ ] **Lektion bearbeiten (#1740):** Meine Inhalte → Karte einer EIGENEN
      Lektion → Stift/Bearbeiten → Wizard öffnet vorausgefüllt; Review
      zeigt "Änderungen speichern" (überschreibt dieselbe id, Fort-
      schritt bleibt) + "Als Kopie speichern"; Fremd-Repo-Lektionen
      zeigen KEIN Bearbeiten; Analyse-Lektionen führen zur Import-Seite.
      **#2201:** "Als Kopie speichern" (und die Import-Kollision "Als
      Kopie importieren") zeigen den Hinweis, dass eine Kopie OHNE
      Lernfortschritt startet, während das Original seinen Fortschritt
      und seine Wiederholungskarten behält
- [ ] **Wiederholkarte übersteht Antwort-Korrektur (#2519):** eigene
      Lektion mit einer Freitext-Übung anlegen/speichern → üben, bis eine
      Wiederholkarte für diese Übung existiert (Wiederholungs-Warteschlange
      zeigt sie) → Lektion bearbeiten, Tippfehler in der akzeptierten
      Antwort korrigieren (z. B. "Merci" → "Merci !"), speichern.
      Erwartung: Toast "{N} Wiederholkarte(n) für die geänderte Antwort
      übernommen." erscheint, die Wiederholkarte bleibt (kein stiller
      Verlust der Fehler-/SRS-Historie). Gilt für BEIDE Speichermodi
      (API + Dexie)
- [ ] **Einfache Lektion (ohne Extension) bleibt speicherbar (#1919):**
      eine Lektion per Auto-Generieren erstellen (nur die sechs CORE-Typen,
      keine Extension-Übung), lokal speichern → über Bearbeiten erneut
      öffnen → zum Review blaettern: der Check "Gültige Lektionsstruktur"
      ist GRUEN und "Änderungen speichern" funktioniert (zuvor scheiterte
      es mit "ext_payload must be object" im API-/Server-Modus)
- [ ] **Buchtext-Lektion bearbeiten (#1967):** eine über "Wissenslektion
      aus Text" (Buchtext-Pfad) erstellte Lektion (Theorie + generierte
      Übungen, KEINE Vokabelkarten) lokal speichern → über "Lektion
      bearbeiten" erneut öffnen → "Weiter" führt DIREKT zum Übungs-Editor
      mit den tatsächlich generierten Übungen (NICHT dem leeren
      Vokabelkarten-Editor, der zuvor die Weiter-Schaltflaeche blockierte);
      der 3-Schritt-Fluss ist Metadaten → Übungen → Review; Review hat
      KEINE "Mindestens 4 Karten"-Zeile und "Änderungen speichern" ist
      aktiv; nach Speichern bleiben Theorie- und Uebungsschritte erhalten.
      Regression: eine normale Karten-Lektion (Vokabel-Liste) UND eine
      Extension-Lektion öffnen weiterhin korrekt zum Bearbeiten
- [ ] **Kleine Buchtext-Lektion (< 5 Übungen) bearbeiten (#1970):** eine
      Buchtext-Lektion, bei der der Generator nur wenige Übungen erzeugt
      hat (z. B. 4, weil Wort-Kacheln/Bildauswahl/Multiple-Choice mangels
      Beispielsätzen/Bildern übersprungen wurden), lokal speichern → über
      "Lektion bearbeiten" öffnen → ALLE gespeicherten Übungen werden
      angezeigt; "Weiter" ist NICHT durch "5 Übungen nötig" blockiert und
      "Änderungen speichern" ist aktiv (die Mindestanzahl gilt nur für die
      Neuerstellung, nicht für das Bearbeiten einer bereits gültigen
      Lektion); der irrefuehrende Hinweis "Wort-Kacheln/Bildauswahl/
      Multiple-Choice ergaben keine Übungen" + der Generieren-Bereich
      erscheinen im Bearbeiten NICHT (keine Karten zum Generieren). WICHTIG:
      Bearbeiten-Öffnen ändert die gespeicherte Datei NICHT (kein Auto-Save);
      es gehen keine Übungen verloren
- [ ] **Set mit mehreren Lektionen bearbeiten (Lektions-Auswahl, #1971):** ein
      Set, das MEHRERE Lektionen enthält (z. B. ein Buchtext-Upload mit
      Mehrfach-Abschnitts-Auswahl → eine Lektion pro Abschnitt), über "Lektion
      bearbeiten" öffnen → oben erscheint eine **Lektions-Auswahl** (Dropdown
      mit allen Lektionen des Sets); die erste Lektion ist vorausgewaehlt und
      ihre Übungen sichtbar. Andere Lektion wählen → deren Theorie/Übungen
      werden geladen (vorher unerreichbar). Bei ungespeicherten Änderungen vor
      dem Wechsel erscheint ein Bestätigungsdialog ("Lektion wechseln?"). Eine
      Lektion bearbeiten + speichern → NUR diese Lektion wird ersetzt, die
      anderen bleiben erhalten, und der SET-Titel/Level/Sprachen ändern sich
      NICHT (werden nicht durch den Titel der bearbeiteten Lektion ueberschrieben).
      Regression: ein Set mit nur EINER Lektion zeigt KEINE Lektions-Auswahl
- [ ] **Lektionswechsel behält den Schritt (#2061):** ein Set mit mehreren
      Lektionen über "Lektion bearbeiten" öffnen, zu **Schritt 2 (Übungen)**
      navigieren (Übungsliste sichtbar) → im Dropdown "Lektion in diesem Set"
      eine ANDERE Lektion wählen → der Wizard BLEIBT auf Schritt 2, nur die
      Übungsliste wechselt auf die gewählte Lektion (vorher: Ruecksprung auf
      Schritt 1, "Weiter" musste erneut gedrückt werden). Gleiches auf
      Schritt 3 (Überprüfung): der Schritt bleibt erhalten. Randfälle: Wechsel
      auf eine Lektion OHNE Übungen zeigt eine leere Liste ohne Absturz und ohne
      Ruecksprung; bei ungespeicherten Änderungen erscheint weiterhin zuerst der
      "Lektion wechseln?"-Bestätigungsdialog. Desktop + iOS-Standalone prüfen
- [ ] **Buchangabe bleibt beim Bearbeiten erhalten (#1989):** eine Lektion über
      den Buchtext-Wizard MIT ausgefuellter "Buchangabe (optional)" (Titel,
      Autor, URL, ISBN/ASIN) erstellen + speichern → in der Lektion erscheint
      unter "Vertiefe das Thema" die Buchreferenz. Dann über "Lektion
      bearbeiten" öffnen, etwas ändern, speichern → die Buchangabe ist
      WEITERHIN vorhanden (vorher: verschwand nach dem ersten Bearbeiten). Über
      MEHRERE Bearbeitungszyklen bleibt sie erhalten; auch "Als Kopie speichern"
      übernimmt die Buchangabe. Regression: eine Lektion OHNE Buchangabe
      bekommt beim Bearbeiten KEIN leeres Buch-Objekt aufgezwungen
- [ ] **Alte englische Prompts migrieren beim Bearbeiten (#1860):** eine
      VOR #1855 erzeugte Alt-Lektion (Uebungsanweisungen fest englisch, z. B.
      "Match each word with its translation.") über "Lektion bearbeiten"
      öffnen → die betroffenen Anweisungen erscheinen automatisch in der
      UI-Sprache + ein dezenter, schliessbarer Hinweis oben ("... automatisch
      in deine Sprache übertragen"). NUR bei EXAKT dem alten Default: ein vom
      Nutzer bewusst abweichend gesetzter Prompt (auch zufällig englisch)
      bleibt unverändert. Editor ohne Speichern verlassen → Original in
      Dexie unverändert (kein stiller Schreibvorgang); erst Speichern
      (Überschreiben/Als Kopie) schreibt die migrierte Fassung dauerhaft
- [ ] **Lektionen kombinieren (#1741):** [E2E: `combine-lessons.spec.ts`] Meine Inhalte → "Zu Set
      kombinieren"-Umschalter → Checkbox-Auswahl (nur eigene Sets) →
      "Kombinieren"-Dialog: Neues Set (Titel Pflicht) vs. zu bestehendem
      Set; Originale bleiben erhalten; gemischte Sprachen/Level → nicht-
      blockierende Warnung
- [ ] **Gleiche-Sprache-Hinweis (#1721/#1730):** Quelle == Ziel zeigt
      neutralen Hinweis, blockiert "Weiter" NICHT; Save wird aktiv sobald die
      Checkliste passt
- [ ] **Inhaltsdomain-Auswahl in Schritt 1 (#1716):** Schritt 1 zeigt ein
      Feld "Bereich" (Domain). Default "Sprache" → Quell-/Zielsprache +
      GER-Level werden angezeigt (wie bisher). Eine Wissensdomain wählen
      (z. B. "Psychologie", "Programmierung", "Wissen") → das Sprachpaar
      klappt auf EINE "Inhaltssprache" zusammen (Quelle == Ziel), das Level
      bietet zusätzlich "Kein Niveau", und ein Hinweis erklärt die
      Wissensinhalte. Inhaltssprache ändern → Quelle und Ziel bleiben
      gleich. Zurück auf "Sprache" → das Paar ist wieder getrennt und das
      Level fällt auf A1 zurück (sofern es "Kein Niveau" war). Speichern →
      die Lektion trägt die gewählte Domain (`domain: psychology` …); eine
      Sprachlektion trägt KEIN `domain`-Feld. Bearbeiten einer gespeicherten
      Wissenslektion öffnet wieder mit der richtigen Domain + Inhaltssprache
- [ ] **Sprachpaar-Pruefpunkt (#1929):** Review zeigt SECHS Checklisten-
      Punkte (Titel, "Sprachpaar ist gültig", ≥4 Karten, ≥5 Übungen,
      ≥2 Typen, gültige Struktur). "Sprachpaar ist gültig" ist grün,
      sobald Quell- UND Zielsprache unterstuetzte Codes sind — ein
      Gleiche-Sprache-Paar (de → de) ist GUELTIG (kein "Quelle != Ziel"-
      Gate)
- [ ] **Struktur-Check-Grund (#1724):** fehlgeschlagener "Gültige
      Lektionsstruktur"-Check nennt einen konkreten Grund, nicht nur ✗
- [ ] **Interner Struktur-Fehler (#2384):** schlägt der "Gültige
      Lektionsstruktur"-Check mit einem INTERNEN Fehler fehl (z. B.
      `(0 , T.default) is not a function`), erklärt die Meldung, dass es
      ein Problem der App und NICHT der Lektion ist, nennt einen
      Neuladen/Erneut-versuchen-Weg und bietet einen "Problem melden"-Link
      — statt den technischen String als ungueltige Nutzer-Struktur zu
      praesentieren
- [ ] **Template-Titel (#1674/#1756):** Template-Karten zeigen lesbare
      Titel (auch offline) + einen gedrueckten/ausgewählten Zustand
- [ ] **Erweiterte Übungstypen / Extension-Wizard (#1852, #1887):** Schritt 1
      → Karte "Erweiterte Übungstypen" startet einen eigenen 3-Schritt-Flow
      (Autoren → Review → Speichern) mit einem nicht-blockierenden Hinweis,
      dass diese Typen fortgeschritten sind. Schritt 2: "Erweiterungsuebung
      hinzufügen" bietet sechs Typen — **Kategorisierung**, **Fehlerkorrektur**,
      **Leseverständnis**, **Benotetes Quiz**, **Diktat**,
      **Bildbeschreibung**. Je Typ öffnet der
      Inline-Editor mit den passenden Feldern; Speichern ist deaktiviert bis der
      shipped Validator erfuellt ist (Kategorisierung: ≥2 benannte Buckets mit
      Items; Fehlerkorrektur: ≥2 Wörter + markierter Fehler + Korrektur;
      Leseverständnis: Text + ≥1 vollständige Frage; Benotetes Quiz: ≥1 Frage
      mit positiven Punkten; Diktat: nicht-leerer Audio-Pfad + ≥1 akzeptierte
      Transkription; Bildbeschreibung: nicht-leeres Bild + ≥1 akzeptierte
      Antwort). Leseverständnis + Benotetes Quiz: pro Frage Umschalten
      Multiple-Choice ⇄ Freitext, MC-Optionen mit Richtig-Haken, Benotetes Quiz
      zusätzlich Punkte + Teilpunkte + Bestehensgrenze. Diktat (#1887): ein
      getippter `assets/audio/...`-Pfad (kein Upload in v1) + die Liste der
      akzeptierten Transkriptionen. Review zeigt die Anzahl; "Lokal speichern" →
      gespeicherte Lektion **abspielbar** (jeder Typ rendert + ist beantwortbar);
      die Set-JSON trägt `requires_extensions: ["ext:al-...@1"]`
- [ ] **Diktat im Core-Typ-Picker (#1895):** Haupt-Wizard (kartenbasiert),
      Schritt 3 "Übung generieren" → "Übung hinzufügen" öffnet den Picker
      "Übungstyp wählen". Neben den sechs Core-Typen (Zuordnung, Freitext,
      Lueckentext, Wort-Kacheln, Bildauswahl, Multiple Choice) erscheint als
      **siebte Option "Diktat"**. Klick → eine Diktat-Übung wird angehängt und
      öffnet direkt im **gleichen** Editor wie im Extension-Wizard (Audio-Pfad +
      akzeptierte Transkriptionen), gegatet durch **denselben** Validator (leerer
      Audio-Pfad / keine Transkription → Speichern deaktiviert; unvollstaendige
      Diktat-Übung blockiert auch "Weiter" nach Schritt 4). Nach dem Speichern:
      die gespeicherte Lektion **trägt `requires_extensions: ["ext:al-dictation@1"]`**
      (egal ob über den Core-Picker ODER den Extension-Wizard angelegt) und ist
      abspielbar. **Regression:** der bestehende Extension-Wizard-Weg für Diktat
      funktioniert unverändert
- [ ] **Erweiterungstypen im Core-Picker (#2508):** Haupt-Wizard (kartenbasiert),
      Schritt 3 "Übung generieren" → "Übung hinzufügen" öffnet "Übungstyp wählen".
      Unter den Standardtypen (sechs Core-Typen + Diktat) erscheint jetzt eine
      zweite, beschriftete Gruppe **"Erweiterungstypen"** mit Kategorisierung,
      Fehlerkorrektur, Leseverständnis, Benotetes Quiz und Bildbeschreibung
      (Diktat erscheint **nicht** doppelt). Klick auf einen dieser Knöpfe → eine
      Erweiterungsübung wird angehängt und öffnet direkt im Extension-Editor.
      Bildbeschreibung ist hier **wählbar** (das Bild wird im Editor ergänzt).
      "Lokal speichern" → die gespeicherte Lektion trägt
      `requires_extensions: ["ext:al-...@1"]` und ist abspielbar. **iOS-Standalone
      (zum Home-Bildschirm hinzugefügte PWA, Dexie-Modus):** Picker öffnet, beide
      Gruppen sind sichtbar und antippbar, die gewählte Erweiterungsübung wird
      gespeichert und rendert nach einem Reload. **Regression:** der separate
      Erweiterungs-Wizard funktioniert unverändert
- [ ] **Diktat-Audio-Upload (#1911, Slice 3):** Im Diktat-Editor (Core-Picker
      ODER Extension-Wizard) zeigt das Audio-Feld einen **"Audio hochladen"**-
      Button über einem **"…assets/audio/clip.mp3"**-Pfad-Eingabefeld. Klick auf
      Hochladen → ein Dateiauswahldialog bietet MP3/OGG/WAV. Echten Clip wählen
      → ein eingebetteter **Audio-Player + "Entfernen"** erscheinen (das Pfad-Feld
      bleibt leer; der Base64-Blob wird nicht angezeigt), die Liste der
      akzeptierten Transkriptionen funktioniert weiter. Lektion speichern,
      abspielen: **"Listen first" spielt den hochgeladenen Clip** in der Lektion
      (beide Storage-Modi, ohne assets-Ordner — der Clip reist als Data-URI in
      der Lektion-JSON mit und überlebt Export/Import). **Entfernen** löscht
      ihn. **Regression:** ein getippter `assets/audio/…`-Pfad funktioniert weiter
      als Alternative (kein Upload). **Fehler:** eine zu grosse Datei (> 2 MB)
      ODER ein falsches Format (z. B. `.mp4`) zeigt eine klare Inline-Fehlermeldung
      und stuerzt nicht ab; nichts wird gespeichert
- [ ] **Bildbeschreibung-Authoring (#2095):** Im Extension-Wizard
      **Bildbeschreibung** wählen. Der Editor zeigt einen **"Bild
      hochladen"**-Button (Label "Zu beschreibendes Bild", NICHT "(optional)"),
      einen sichtbaren Groessen-Hinweis ("komprimiert und eingebettet, max.
      ~150 KB / 512 px, externe Links nicht erlaubt") und eine Liste
      **"Akzeptierte Antworten"**. Echtes JPG/PNG/WebP hochladen → Inline-
      Vorschau + "Entfernen" erscheinen; das Bild wird als Data-URI komprimiert
      (kein assets-Ordner nötig). Speichern ist deaktiviert bis es ein Bild UND
      ≥1 akzeptierte Antwort gibt. Lektion speichern, abspielen: das **Bild wird
      gezeigt**, Beschreibung tippen, richtig / knapp daneben / falsch zeigt die
      Lösung. **Offline:** Netz ausschalten und neu laden — das eingebettete
      Bild wird WEITERHIN angezeigt (es reist in der Lektion-JSON, keine
      entfernte URL). **Fehler:** ein Bild, das nicht unter das Budget
      schrumpfbar ist, zeigt eine klare Inline-Fehlermeldung, nichts wird
      gespeichert. **iOS-Standalone (PFLICHT):** in einer installierten iOS-PWA
      eine Bildbeschreibung-Lektion mit hochgeladenem Foto anlegen, Backup
      exportieren (`.alb`), neu installieren/löschen, importieren → Lektion
      öffnen: Bild + akzeptierte Antworten sind intakt und das Bild wird ohne
      Netz angezeigt (beweist, dass das eingebettete Bild den iOS-IndexedDB- +
      Backup-Round-Trip überlebt, die bekannte Verdraengungs-Risikoflaeche)
- [ ] **Multiple-Choice Single/Multi-Umschalter (#1888):** [E2E: `mc-single-multi-toggle.spec.ts`] Im MC-Inline-Editor
      (Schritt 3, `ExerciseEditor`) steht der Modus-Umschalter
      ("Wie viele Antworten sind richtig?") als Segmented-Control **ganz oben,
      vor der ersten Options-Zeile**. Neue MC-Übung (KI-generiert ODER manuell
      angelegt): Default ist **"Eine Antwort erlauben"**, die Options-Marker
      sind Radios (genau eine richtig). Umschalten auf **"Mehrere Antworten
      erlauben"** → Marker werden Checkboxen, zwei richtige möglich,
      gespeicherte Übung ist mit Mehrfachauswahl **abspielbar**. Zurück auf
      "Eine Antwort" → auf genau eine richtige reduziert. Eine bestehende
      MC-Übung mit gesetztem `multiple`-Wert öffnet **unverändert** in ihrem
      urspruenglichen Zustand.
- [ ] **Aufgabentyp umwandeln -> Freitext (EXP-050 Stufe 1, #2511):** Im
      Inline-Editor (Schritt 3, `ExerciseEditor`) einer **Wortkacheln**- oder
      **Multiple-Choice**-Übung steht oben ein Auswahlfeld **"Aufgabentyp"** mit
      dem aktuellen Typ und der Alternative **"Freitext"**. Auf "Freitext"
      umstellen: die Felder wechseln zum Freitext-Editor, die **akzeptierte
      Antwort ist vorbefüllt** (Wortkacheln: die zusammengesetzte Kachel-Reihe;
      MC: die richtige Option, falsche Optionen wandern in die Distraktoren).
      Speichern und die Übung als Freitext abspielen. Bei anderen Übungstypen
      (Freitext, Matching, Cloze, Bildauswahl) erscheint **kein** Auswahlfeld.
      Erwartung: der Lernfortschritt der umgewandelten Übung bleibt erhalten
      (gleicher Antwort-Schlüssel), Abbrechen verwirft die Umwandlung.
- [ ] **Extension-Aufgabe umwandeln -> Freitext (EXP-050 Stufe 1, #2511):**
      Eine **bestehende Lektion mit einer Diktat- oder Bildbeschreibungs-Übung
      bearbeiten** (nicht der reine "Extension hinzufügen"-Flow). Im
      Inline-Editor der Diktat-/Bildbeschreibungs-Zeile steht dasselbe
      Auswahlfeld **"Aufgabentyp"** mit der Alternative **"Freitext"**. Auf
      "Freitext" umstellen: der Editor **wechselt zum Freitext-Editor**, die
      akzeptierten Transkriptionen/Antworten sind als akzeptierte Antworten
      **vorbefüllt** (das Audio/Bild entfällt). Speichern -> die Lektion enthält
      jetzt eine Freitext-Übung. **Abbrechen** nach dem Umschalten stellt die
      **ursprüngliche Diktat-/Bildbeschreibungs-Übung wieder her**. Wichtig: Im
      reinen "Extension-Aufgaben hinzufügen"-Flow (`ExtensionSteps`) erscheint
      das Auswahlfeld **nicht** (dort ist ein Kern-Typ nicht gültig).

### Karten-Bild-Upload (#1763 / #1764) [E2E: `card-image-upload.spec.ts`]

Ort: Create-Lesson Schritt 2 (Karten-Editor), im Hinzufügen-Formular +
jeder Karten-Zeile (`CardImageField`).

- [ ] Feld "Bild (optional)" mit "Bild hochladen"-Button; nach Upload
      64x64-Vorschau + "Entfernen"
- [ ] Nur JPEG / PNG / WebP akzeptiert; anderer Typ → Inline-Fehler
      (role=alert), kein Crash
- [ ] Grosse Datei wird runterskaliert (≤512px Kante, ~150 KiB Kappe);
      undekodierbare Datei → Fehler statt Crash
- [ ] "Erweitert: Asset-Pfad verwenden" behält das manuelle
      `img/…png`-Feld (für repo-publizierte Sets)
- [ ] Round-Trip: Karte mit hochgeladenem Bild → exportieren →
      re-importieren → Bild erhalten
- [ ] Bekannte Grenze: hochgeladene data-URI-Bilder werden noch NICHT in
      einer gespielten picture_choice-Übung gerendert (Engine `src`-Kappe)

### Lesson-Player UX (v2.3.0)
- [ ] Pause-Button liegt jetzt im Sticky-Footer (#1644), Pausieren
      funktioniert von dort
- [ ] Auto-Weiter + "Zurück" (#1921): Einstellung "Automatisch weiter"
      (Settings -> Lernen) AN -> eine Übung richtig beantworten, die App
      springt automatisch zur nächsten Aufgabe -> dann "Zurück" klicken:
      die vorherige (bereits geloeste) Aufgabe bleibt stehen und springt
      NICHT sofort wieder vor; der "Weiter"-Button ist weiter klickbar
- [ ] Titelbereich schlanker, keine In-Lektion-Beschreibung mehr (#1635)
- [ ] Lektions-Zusammenfassung zeigt nur EINEN Favoriten-Button (#1649)
      [E2E: `lesson-summary-favorite.spec.ts`]
- [ ] Skip-to-Content-Link beim Tabben von oben sichtbar (#1727, a11y)
- [ ] **[MOBILE/VoiceOver, nicht blockierend] Auswahlfelder werden benannt
      angesagt (#2037):** iOS VoiceOver einschalten, `/create-lesson`
      Schritt 1 öffnen und über die Auswahlfelder (Domain, Sprache(n),
      Niveau) wischen: VoiceOver sagt jeweils das SICHTBARE Label plus den
      gewaehlten Wert an (z. B. "Niveau, A1, Auswahlfeld") - NICHT nur den
      Wert und nicht "Button" ohne Namen. Gleiches im Teilen-Assistenten
      und bei den Chat-Import-Sprachwaehlern. Automatisiert abgedeckt via
      axe (`select-a11y.spec.ts`); dieser Punkt ist die Gegenprobe mit
      echtem Screenreader in der nächsten iOS-Session

### Ungueltige Lektion: freundliche Fehlermeldung (#1808 / #1824)
- [ ] Deutsche Umlaut-Karten (`währung`, `präsenz`) laden korrekt
      (App akzeptiert Unicode-Kleinbuchstaben in Karten-ids/-tags, #1808)
- [ ] Eine tatsächlich kaputte Lektion zeigt AUSSERHALB des Entwickler-
      modus eine freundliche Meldung ("… ungueltige oder beschaedigte
      Daten … Autor kontaktieren"), NICHT den rohen Fehler-Dump (#1824)
- [ ] Mit Entwicklermodus AN (Settings): der technische Detail-Text
      erscheint wieder angehängt

### Discover + Registry (seit v2.2.0)
- [ ] Source-Language-Filter als sichtbarer Chip auf erster Ansicht
      (nicht mehr hinter "Filter" versteckt), "Alle Sprachen" persistiert
      über Reload (#1699/#1701)
- [ ] Referenz-/Demo-Sets (graded-quiz-demo) erscheinen NICHT in
      Discover/Meine Inhalte (#1702/#1706)
- [ ] Per-Set Share-Link öffnet direkt die Set-Detailseite (#1572)
- [ ] Registrierten Content-Repo hinzufügen (register-a-repo #1511)
- [ ] Manifest-Fallback für eigene Repos ohne search-index.json (#2562):
      eigenes Repo über Settings → Daten → "Repository hinzufügen" verbinden,
      das NIE mit dem Engine-Generator gebaut wurde (kein search-index.json
      an der Wurzel) - Sets erscheinen trotzdem in Entdecken; sobald mehr als
      eine Quelle beiträgt, erscheint der Filter "Quelle" (vorher fehlte er
      bei nur einer beitragenden Quelle)
- [ ] "Als Repository teilen" (#2376): ein Set mit Qualitätsmängeln
      (z. B. Zuordnungsübung mit doppeltem linkem Wert) wird beim ersten
      Klick NICHT gepusht - die Mängelliste erscheint, der Button wechselt
      auf "Trotzdem exportieren"; erst der zweite Klick exportiert
- [ ] "Als Repository teilen" (#2376): bei Lektionsdateien, deren Namen
      nicht in Quellreihenfolge sortieren (kapitel-1..kapitel-10), meldet
      der Erfolgs-Screen die Umbenennung mit NN-Präfixen; das exportierte
      Repo listet die Lektionen in Quellreihenfolge

### Discover Stufe 1: Facetten, Marken, Leerzustand (EXP-048, #2320-#2324)

Ort: Entdecken (`/content?tab=discover`). In BEIDEN Speichermodi prüfen
(API + Dexie); die Facetten lesen den Suchindex und sind modusunabhängig.

- [ ] Zielsprache-Facette neben der Quellsprache sichtbar; Marken tragen ihre
      Trefferzahl, nur belegte Ziele der aktiven Quellsprache, nach Menge
      sortiert; Auswahl filtert die Liste (#2322)
- [ ] Durchsichtsstand: maschinell erzeugte Sets (z. B. ja-a1-from-de,
      ko-a1-from-de, zh-a1-from-de) tragen ein neutrales Abzeichen
      ("Maschinell erstellt"), handgeschriebene Sets KEIN Abzeichen; die
      Facette "Durchsicht" erscheint nur, wenn solche Sets im Katalog sind
      (#2321)
- [ ] "KI-geprüft"-Facette ist verschwunden; das KI-Abzeichen am Eintrag
      bleibt (#2321)
- [ ] Aktive Einschränkungen (Niveau, Bereich, Vertrauen, Durchsicht, Suche)
      stehen als entfernbare Marken über der Liste; ein Klick auf das X einer
      Marke löst genau diese Einschränkung (#2323)
- [ ] Bereichs-Namen sind übersetzt (Hundetraining, Technik, Software,
      Philosophie, Verkehrskunde statt roher Bezeichner) (#2320)
- [ ] Leerzustand: bei null Treffern erscheinen berechnete Auswege
      ("Ohne <Facette>: N Sets") und "Alle Filter zurücksetzen"; ein Klick
      stellt Treffer wieder her; die Quellsprache bleibt erhalten (#2324)
- [ ] Leere Bibliothek (kein Set): Hinweis auf "Eigene Quelle hinzufügen"
      (/add-repo) bzw. "eine Lektion anlegen" (/create-lesson) (#2324)
- [ ] Telefon (schmale Breite): die Markenzeile bleibt EINE waagerecht
      scrollbare Zeile, bricht nicht um und frisst nicht die halbe Höhe
- [ ] **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):**
      gleicher Ablauf auf dem iPhone-PWA - die Facetten-Menüs öffnen über
      der Liste (Portal/Fixed, #1349), die Markenzeile scrollt waagerecht, und
      die Leerzustand-Auswege sind tippbar (>=44px Touch-Ziel)

### Discover Stufe 2: Einstiege, Quellen-Facette, Sprachnamen-Suche (EXP-048, #2329-#2331)

Ort: Entdecken (`/content?tab=discover`). In BEIDEN Speichermodi prüfen
(API + Dexie); die Facetten lesen den Suchindex und sind modusunabhängig.

- [ ] Einstieg-Steuerung ("Ich möchte") als erste dauerhaft sichtbare Marke;
      drei Vorbelegungen mit Trefferzahl: Sprache lernen / Fachgebiet / Alles
      (#2331)
- [ ] Vorbelegung "Sprache lernen" (Standard beim ersten Besuch): nur
      Sprachsets; Zielsprache- und Niveau-Facette sichtbar, Bereichs-Facette
      ausgeblendet (#2331)
- [ ] Umschalten auf "Fachgebiet": nur Wissenssets; Bereichs-Facette sichtbar,
      Niveau- und Zielsprache-Facette ausgeblendet; die Wahl bleibt nach einem
      Reload gemerkt (#2331)
- [ ] "Alles" zeigt beide Populationen; Umschalten löscht die vom neuen
      Einstieg ausgeblendeten Einschränkungen, sodass die Liste nicht still
      auf null fällt (#2331)
- [ ] Quellen-Facette: erscheint, sobald mehr als eine Quelle vorhanden ist;
      Auswahl schränkt auf diese Quelle ein, mit Trefferzahl je Quelle (#2330)
- [ ] Sprachnamen-Suche: die Oberfläche auf Englisch stellen und "Spanish"
      eingeben findet die deutschsprachigen Spanisch-Sets (Sprachnamen der
      UI-Sprache sind durchsuchbar) (#2329)
- [ ] Telefon (schmale Breite): die Einstieg-Marke reiht sich in die EINE
      waagerecht scrollbare Markenzeile ein, bricht nicht um
- [ ] **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):**
      gleicher Ablauf auf dem iPhone-PWA - das Einstieg-Menü öffnet über der
      Liste (Portal/Fixed, #1349), die Vorbelegung bleibt nach dem Beenden der
      PWA gemerkt, und die Suche nach Sprachnamen funktioniert

### Discover Stufe 3: schubweises Rendern (EXP-048, #2333)

Ort: Entdecken (`/content?tab=discover`). Um über 24 Treffer zu kommen, den
Einstieg auf "Alles" und die Quellsprache auf "Alle Sprachen" stellen. In
BEIDEN Speichermodi prüfbar; die Logik ist modusunabhängig.

- [ ] Bei mehr als 24 Treffern werden zunächst 24 gezeigt; "Weitere anzeigen"
      lädt den nächsten Schub; die Trefferzahl über der Liste bleibt die volle
      Zahl (#2333)
- [ ] Kein Endlos-Scrollen; nach dem letzten Schub verschwindet der Knopf
- [ ] Eine Filter-, Such- oder Sortieränderung setzt auf den ersten Schub
      zurück
- [ ] Gilt in Karten- und Listenansicht
- [ ] **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):**
      "Weitere anzeigen" ist tippbar (>=44px), und der Zurück-Weg (Geste /
      Navigation) bleibt nach dem Nachladen erhalten

### Discover Stufe 3: Tippfehler-Toleranz + Rangfolge in der Suche (EXP-048, #2336)

Ort: Entdecken (`/content?tab=discover`), Suchfeld. Schwelle bewusst
überschritten: das Merkmal war laut Exploration erst ab etwa 200 Sets
vorgesehen (aktuell rund 46) und wird auf ausdrückliche Nutzer-Entscheidung
schon jetzt gebaut. In BEIDEN Speichermodi prüfbar; die Logik ist
modusunabhängig.

- [ ] Ein Suchwort mit EINEM Tippfehler (z. B. "spanissch" statt "Spanisch")
      findet dieselben Sets wie die korrekte Schreibweise
- [ ] Zwei oder mehr Tippfehler im selben Wort finden das Set NICHT (die
      Toleranz bleibt eng)
- [ ] Sehr kurze Suchwörter (unter 4 Zeichen) bleiben exakt; ein 3-Zeichen-
      Tippfehler findet nichts Falsches
- [ ] Bei einer Mehrwort-Suche muss weiterhin JEDES Wort passen; ein
      unpassendes zweites Wort schließt das Set aus
- [ ] Exakte Treffer stehen über reinen Tippfehler-Treffern, wenn nach
      "Relevanz" sortiert wird
- [ ] **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):** die
      Tippfehler-Suche funktioniert ohne Netz genauso wie im Server-Modus

### Discover Stufe 3: Sprachpaar-Auswahl (alternativer Einstieg, aufklappbar) (EXP-048, #2337, #2359)

Ort: Entdecken (`/content?tab=discover`), Bereich "Sprachpaare" über der
Trefferliste. Schwelle bewusst überschritten: laut Exploration erst ab etwa 30
belegten Paaren vorgesehen (aktuell 14) und auf ausdrückliche
Nutzer-Entscheidung schon jetzt gebaut. Sichtbar im Einstieg "Sprache lernen"
und "Alles", sobald mehr als ein Sprachpaar belegt ist. In BEIDEN
Speichermodi prüfbar; die Logik ist modusunabhängig.

- [ ] Über der Liste steht EIN aufklappbarer Knopf, standardmäßig ZU; ohne
      Auswahl trägt er "Sprachpaar wählen (N)" mit der Paarzahl (#2359)
- [ ] Aufklappen (Klick/Tippen auf den Knopf) zeigt die belegten Paare, nach
      QUELLSPRACHE gruppiert (Überschrift je Quellsprache, darunter die Ziele
      mit Trefferzahl, das meistbelegte zuerst); erneutes Tippen klappt zu
      (#2359)
- [ ] Ein Tippen auf ein Ziel setzt Quell- UND Zielsprache zugleich und
      schaltet auf den Einstieg "Sprache lernen"; die Liste zeigt danach nur
      noch die Sets dieses Paars (#2337)
- [ ] Nach der Wahl fasst der eingeklappte Knopf sie zusammen, z. B.
      "Deutsch → Spanisch"; das gewählte Ziel ist im aufgeklappten Zustand
      hervorgehoben (aktiv markiert) (#2359)
- [ ] Ein Paar in einer ANDEREN Erklärsprache (z. B. Gruppe "Englisch",
      Ziel "Spanisch") springt auch dorthin; die Quellsprache bleibt danach
      frei änderbar (#2337)
- [ ] Im Einstieg "Fachgebiet" erscheint die Sprachpaar-Auswahl nicht (#2337)
- [ ] Fahnen-Icons: vor jedem Sprachnamen steht ein Flaggen-Emoji - in den
      Gruppen-Überschriften und Ziel-Knöpfen der Paar-Auswahl UND in den
      Quell-/Zielsprache-Menüs; der Sprachname bleibt daneben stehen, sodass
      auf Plattformen ohne Flaggen-Emoji (z. B. Windows) weiter der Name lesbar
      ist (#2359). Hinweis: eine Sprache ist kein Land, die Zuordnung ist eine
      bewusste Konvention (Englisch -> UK, Portugiesisch -> Portugal)
- [ ] Tastatur: der Knopf ist mit Tab erreichbar und mit Enter/Leertaste auf-
      und zuklappbar; im aufgeklappten Zustand sind die Ziel-Knöpfe per Tab
      erreichbar (#2359)
- [ ] Telefon (schmale Breite): eingeklappt kostet die Auswahl EINE Zeile;
      aufgeklappt bleibt der Inhalt scrollbar und frisst nicht die halbe Höhe
      (#2359)
- [ ] **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):** der
      Aufklapp-Knopf und die Ziel-Knöpfe sind tippbar (>=44px), das Auf- und
      Zuklappen funktioniert, und die Auswahl wirkt ohne Netz genauso wie im
      Server-Modus (#2359)

### Set-Status bleibt erhalten (aktiv/zurückgestellt/abgeschlossen, beide Modi)

Ort: Meine Inhalte (`/content?tab=my`) → Set-Aktionen-Menü (Drei-Punkte)
eines heruntergeladenen Sets. In BEIDEN Speichermodi prüfen (Desktop/
Server = API-Modus; GitHub-Pages-PWA = Dexie-Modus), da der Bug früher nur
im API-Modus auftrat.

- [ ] Set auf **Zurückgestellt** setzen → in eine andere Maske wechseln
      (z. B. Dashboard) → zurück zu Meine Inhalte → Status ist WEITERHIN
      "Zurückgestellt" (nicht wieder "Aktiv")
- [ ] Rueckweg prüfen: einmal über das Menü/Navigation, einmal über den
      Browser-Zurück-Button
- [ ] Alle Übergänge testen: aktiv → zurückgestellt → abgeschlossen →
      wieder aktiv; jeder bleibt nach einem Maskenwechsel erhalten
- [ ] Zweite Stufe (echter Persistenz-Beweis): App komplett schliessen und
      neu öffnen → zurückgestellter Status ist noch da
- [ ] iPhone-PWA: gleicher Ablauf (dort ursprünglich beobachtet)

### Weitermachen-Vorschlag: keine abgeschlossenen/zurueckgestellten Sets ohne faellige Wiederholungen (#2123)

Ort: Dashboard → Übersicht, oberster Block "Weitermachen" / "Continue
Learning". In BEIDEN Speichermodi prüfen (API + Dexie), die Logik ist
modus-unabhängig.

- [ ] Ein Set komplett durchspielen (alle Lektionen abschliessen) ODER über
      das Set-Aktionen-Menü auf "Abgeschlossen" setzen, KEINE fälligen
      Wiederholungskarten → der "Weitermachen"-Block schlägt dieses Set NICHT
      mehr vor (früher stand es dort als "Set abgeschlossen")
- [ ] Kein offenes Set UND keine fälligen Karten → ehrlicher Leerzustand
      ("Starte deine erste Lektion", Link zu Meine Inhalte) statt irgendein
      Set als Lueckenfueller
- [ ] Abgeschlossenes Set MIT fälligen Wiederholungen → erscheint als
      Wiederholungs-Zeile ("N Elemente fällig") und führt in die
      Wiederholungs-Session (`/review/{setId}`), nicht als "Set abgeschlossen"
- [ ] Zurueckgestelltes Set ohne faellige Karten → wird NICHT vorgeschlagen
- [ ] Angefangenes (aktives) Set → wird weiterhin zum Fortsetzen vorgeschlagen
- [ ] Reihenfolge: faellige Wiederholungen zuerst, dann angefangene Sets
      (jeweils zuletzt-bearbeitet zuerst)

### Update-Schutz: kein stiller Fortschrittsverlust beim Set-Update (#2128)

Ort: Meine Inhalte, ein bereits GELERNTES Set (Fortschritt + Wiederholungskarten
vorhanden), für das ein Update verfügbar ist. In BEIDEN Speichermodi prüfen.
Hintergrund: ein Update, das Übungs-/Karten-Identitäten ändert (z. B. eine
Antwort-Korrektur), würde Wiederholungskarten verwaisen. Der Schutz hängt an
einem echten Alt-gegen-neu-Vergleich, nicht an einem pauschalen Abschalten.

- [ ] Vorbereitung: ein Set lernen (mind. eine Lektion, ein paar Fehler erzeugen
      -> Wiederholungskarten), für das eine geänderte Fassung mit GEAENDERTER
      Antwort/Kartenfront bereitsteht.
- [ ] Manuelles Update anstossen (Button "Update" am Set): Es erscheint eine
      Bestätigung mit bezifferter Angabe ("N Wiederholungskarten / N Lektionen
      würden zurückgesetzt"), NICHT ein stilles Überschreiben.
- [ ] "Aktuelle Version behalten" -> nichts wird aktualisiert, Fortschritt bleibt,
      Set zeigt weiterhin "Update verfügbar" (sichtbar + erneut entscheidbar).
- [ ] "Trotzdem aktualisieren" -> Update wird angewendet.
- [ ] Harmloses Update (nur neue Lektion/Übung ergänzt, keine bestehende
      Kennung geändert) -> KEINE Nachfrage, läuft direkt durch.
- [ ] Auto-Sync (nur bei verbundenem Nutzer-Repo, 24h): ein identitaets-aenderndes
      Update wird im Hintergrund NICHT still angewendet; das Set bleibt auf der
      bisherigen Fassung und zeigt "Update verfügbar" (kein Hintergrund-Dialog,
      kein Datenverlust).
- [ ] iOS-Standalone (PWA): gleicher manueller Ablauf, Bestätigung erscheint.
- [ ] Übernahme-Vorschlag (#2308): Im Bestätigungsdialog erscheint zusätzlich
      eine Liste "alt -> neu" der Wiederholungen, die übernommen werden könnten,
      plus ein Haken "Gelernten Fortschritt übernehmen" (standardmäßig gesetzt,
      WEIL die Paare darüber sichtbar sind).
- [ ] Mit gesetztem Haken bestätigen: Nach dem Update sind Fehlerzähler, Serie
      und Beherrschungs-Status an der KORRIGIERTEN Antwort vorhanden (die
      Wiederholung startet nicht bei null). Toast nennt die Anzahl.
- [ ] Haken ENTFERNEN und bestätigen: Update läuft, es wird NICHTS übernommen
      (Verhalten wie vor #2308). Der Haken ist die Entscheidung, nicht Deko.
- [ ] Nicht zuordenbare Fälle: Wurde in einer Übung die REIHENFOLGE geändert
      oder ein Element eingefügt/entfernt, nennt der Dialog diese getrennt
      ("N lassen sich nicht sicher zuordnen und werden zurückgesetzt"). Prüfen,
      dass für diese NICHTS übernommen wurde - eine falsche Zuordnung wäre
      schlimmer als ein Verlust, weil sie unsichtbar ist.
- [ ] AUTH-05: Übungskennung selbst geändert (nicht nur die Antwort) - z. B.
      eine Übung ohne `stable_id` wird beim Update umbenannt (Slug-Wechsel).
      Die Zählung im Haken "Gelernten Fortschritt übernehmen" schließt diesen
      Fall mit ein (kombinierte Zahl aus Übungs- und Element-Ebene); die
      lesbare Vorschauliste zeigt weiterhin nur Antworttext-Paare, keine
      rohen Übungs-Slugs. Nach Bestätigen mit Haken: die Wiederholkarte
      bleibt unter der NEUEN Übungskennung erhalten, kein Neustart bei null.
- [ ] Auto-Sync (24h, verbundenes Nutzer-Repo): Es wird WEDER aktualisiert NOCH
      etwas übernommen. Die Zuordnung darf nur im manuellen Dialog entstehen.
- [ ] Zweimal hintereinander bestätigen (Update erneut anstossen): keine
      doppelte Übernahme, keine Fehlermeldung (idempotent).
- [ ] Sicherung vorher: Der Hinweis auf eine Sicherung ist ein Angebot, kein
      Zwang - das Update lässt sich auch ohne Sicherung bestätigen.
- [ ] iOS-Standalone (PWA): Dialog samt Paar-Liste und Haken ist vollständig
      lesbar und bedienbar (Liste läuft nicht aus dem Dialog, der Haken ist
      antippbar), Übernahme funktioniert im Dexie-Modus genauso.
- [ ] Sprache prüfen (#2160): der Bestätigungstext erscheint in der App-Sprache
      (nicht englisch), in mehreren Sprachen stichprobenartig (de/ja/ko/el/hi).
- [ ] Erst-Prägung (engine#91, Element-Ebene): Set, dessen Paare/Lücken/Optionen
      erstmals eine stable_id erhalten, Inhalt sonst unverändert oder im selben
      Update mitkorrigiert. Der Übergang wird wie eine normale, sicher
      zuordenbare Korrektur behandelt, nicht als "nicht zuordenbar" gemeldet.
      Fortschritt bleibt bei bestätigter Übernahme erhalten.

### Ausmusterung: archivierter Fortschritt bei retired_ids (#2188)

Ort: Inhalte-Seite, Set mit Lernfortschritt, dessen Update im Set-Manifest
`retired_ids` deklariert (Autor hat Übungen bewusst ausgemustert). In BEIDEN
Speichermodi prüfen. Hintergrund: eine erklärte Ausmusterung ist kein
Versehen - der zugehörige Fortschritt wird ARCHIVIERT (nicht gelöscht, nicht
verwaist), verlässt Wiederholungsplanung und Fälligkeitszahlen, und der
Nutzer erfährt es einmal, mit Zahl.

- [ ] Update eines Sets mit deklarierten Ausmusterungen anwenden (manuell oder
      Sync): Es erscheint EIN Hinweis-Toast mit der Anzahl ("N Übungen wurden
      vom Autor ausgemustert; der zugehörige Lernfortschritt ist archiviert.").
- [ ] Nur-Ausmusterungs-Update (keine sonstigen Identitäts-Änderungen):
      KEIN Warndialog (#2128) - die Ausmusterung ist erklärt, nicht brechend;
      das Update läuft durch, nur der Hinweis-Toast erscheint.
- [ ] Nach dem Update: die ausgemusterten Elemente erscheinen NICHT mehr in der
      Wiederholungs-Warteschlange und zählen NICHT mehr in die "N fällig"-Zahl.
- [ ] Update erneut anstoßen: kein zweiter Toast, keine Doppel-Archivierung
      (idempotent; Zahl wäre 0, kein Hinweis).
- [ ] Sprache prüfen: der Hinweis erscheint in der App-Sprache (de/ja/ko
      stichprobenartig).

### Wiederherstellung: Wiederholungsfortschritt nach ja/ko/zh-Korrektur (#2161)

Ort: Dashboard (Übersicht). Hintergrund: die drei A1-Sets Japanisch, Koreanisch
und Chinesisch wurden im Juli 2026 mit einer Umschrift-Korrektur neu
veroeffentlicht, die die Antworttexte von 172 Wiederholungs-Elementen aenderte
(66 ja / 58 ko / 48 zh). Wiederholungskarten haengen am Antworttext, also fielen
bereits angelegte Karten für die geänderten Elemente still aus der Planung.
In BEIDEN Speichermodi prüfen. Nur diese drei Sets sind betroffen; alle anderen
Sets bleiben unberührt.

- [ ] Vorbereitung: eines der Sets (ja/ko/zh A1) in der ALTEN Fassung lernen und
      ein paar Wiederholungskarten erzeugen, dann auf die korrigierte Fassung
      bringen (bzw. Testdaten mit den alten Antwort-Keys).
- [ ] Der Hinweis erscheint auf dem Dashboard NUR, wenn tatsächlich betroffene
      Karten in den eigenen Daten liegen. Kein Hinweis, wenn nichts betroffen ist.
- [ ] Der Hinweis nennt je betroffenem Set die Anzahl betroffener Karten und
      bietet "Sicherung erstellen" an (empfohlen, nicht erzwungen).
- [ ] "Sicherung erstellen" -> es wird dieselbe .alb-Datei wie unter
      Settings → Daten erzeugt (Toast mit Dateiname).
- [ ] "Wiederholungskarten neu verknuepfen" -> beziffertes Ergebnis
      ("N neu verknuepft, N bereits korrekt"). Danach verschwindet der Hinweis
      für dieses Set (kein erneutes Nachfragen).
- [ ] Idempotenz: erneut auslösen (bzw. Seite neu laden) ändert nichts mehr;
      der Hinweis kommt für dieses Set nicht zurück.
- [ ] Teil-Wiederherstellung: falls ein Set nach der Korrektur erneut geändert
      wurde, werden nicht zuordenbare Karten als Anzahl gemeldet und unverändert
      gelassen (nicht still verworfen).
- [ ] "Set neu beginnen" -> Inline-Rückfrage, erst nach Bestätigung werden
      Fortschritt + Wiederholungskarten dieses Sets entfernt; danach ist der
      Hinweis für das Set weg.
- [ ] Kein Doppel-Mapping / keine verwaisten Zeilen: nach dem Neu-Verknuepfen
      keine Wiederholung auf einer falschen Karte, keine doppelten Karten.
- [ ] Backup-Verhalten: eine VOR der Wiederherstellung erstellte Sicherung
      importieren -> die alten (verwaisten) Keys sind wieder da, der Hinweis
      erscheint erneut und lässt sich erneut anwenden.
- [ ] iOS-Standalone (PWA): gleicher Ablauf, Hinweis + beide Aktionen
      funktionieren.
- [ ] Sprache prüfen: Hinweis- und Ergebnistexte erscheinen in der App-Sprache
      (nicht englisch), stichprobenartig in mehreren Sprachen (de/ja/ko/el/hi).

#### Zustand herstellen (Voraussetzung für den Test)

Der Hinweis erscheint nur, wenn betroffene Wiederholungskarten in den eigenen
Daten liegen. Der Herstell-Weg braucht Zugriff auf die Speicherinhalte
(Entwicklerwerkzeuge), und der ist im iOS-Standalone-Modus NICHT gangbar: dafuer
braucht es den Safari-Web-Inspector auf einem Mac, der QA-Rechner läuft unter
Ubuntu. Daher die Plattformregel:

- Der erzeugte Zustand wird auf dem DESKTOP hergestellt und geprüft (App im
  Browser, Entwicklerwerkzeuge verfügbar).
- Auf dem TELEFON (iOS-Standalone) wird NUR geprüft, wenn echte betroffene
  Daten vorliegen.

Zuerst-prüfen (zweistufig):

- [ ] Auf dem Telefon das Dashboard öffnen. Erscheint der Hinweis von selbst,
      liegen ECHTE betroffene Daten vor -> dort testen. Dann gilt die
      Produktbedingung: VORHER "Sicherung erstellen" (Knopf im Hinweis).
- [ ] Erscheint auf dem Telefon kein Hinweis, wandert die Prüfung auf den
      DESKTOP; dort den Zustand herstellen. Ein verwaister Eintrag entsteht nicht
      mehr über die normale Bedienung (die korrigierte Fassung erzeugt bereits
      den neuen Key), daher braucht dieser Schritt Entwicklerwerkzeuge (so
      gekennzeichnet):

- [ ] Sicherung ziehen (Settings -> Daten -> Sicherung erstellen), damit der
      Ausgangszustand wiederherstellbar ist.
- [ ] Japanisch A1, Lektion "01-begruessungen", die Zuordnungs-Übung
      (ex-match-begruessung) einmal lernen und bei "こんにちは" absichtlich falsch
      antworten -> es entsteht eine Wiederholungskarte auf dem NEUEN Key
      "こんにちは (konnichiwa)".
- [ ] [Entwicklerwerkzeuge] Den Key dieser Karte auf die alte Form
      "こんにちは" zuruecksetzen (macht sie verwaist):
      - Server-Modus (SQLite unter
        ~/.local/share/adaptive_learner/adaptive_learner.db), eine Zeile:
        `UPDATE element_errors SET element_key='こんにちは'
        WHERE set_id='ja-a1-from-de' AND lesson_id='01-begruessungen.json'
        AND exercise_id='ex-match-begruessung'
        AND element_key='こんにちは (konnichiwa)';`
      - Dexie-Modus (Browser-DevTools -> Application -> IndexedDB ->
        elementErrors): die neue Zeile löschen und neu anlegen; im Feld
        `element_key` und im Schlüssel `id` jeweils nur das Key-Segment
        "こんにちは (konnichiwa)" durch "こんにちは" ersetzen (alle anderen
        Segmente inkl. direction unverändert lassen).
- [ ] Dashboard neu laden -> der Hinweis erscheint (1 betroffene Karte,
      Japanisch A1).

Weg zurück (Test wiederholbar, keine Spuren):

- [ ] Nach dem Test die in Schritt 1 gezogene Sicherung importieren
      (Settings -> Daten -> Import) -> exakter Ausgangszustand, keine Spuren.
- [ ] [Entwicklerwerkzeuge] Alternativ das UPDATE umkehren (Server) bzw. die
      Testzeile wieder auf den neuen Key setzen (Dexie).

Nicht abgedeckt: Wird der Zustand nur auf dem Desktop erzeugt und geprüft,
bleibt das Verhalten des Hinweises im iOS-Standalone-Modus UNBELEGT (die
Herstellung ist dort ohne Mac-Web-Inspector nicht möglich). Das ist ein
zulässiges Ergebnis, aber ausdrücklich als offen zu vermerken, nicht
stillschweigend mit dem Desktop-Ergebnis gleichzusetzen.

### Download-Sichtbarkeit (Dexie-Modus, #1709 / #1719 / #1731)
- [ ] Gelöschtes Set bleibt gelöscht: Set in Meine Inhalte löschen →
      Aktualisieren → Set kommt NICHT zurück (#1719)
- [ ] Set aus einer nicht mehr konfigurierten Quelle bleibt in Meine
      Inhalte sichtbar (nicht still versteckt) (#1731/#1734)
- [ ] Buch-Empfehlungen kommen aus der foederierten Registry, nicht aus
      der entfernten offiziellen `books.yaml` (#1717)

### Einzelne Lektion löschen (#2064)

Ort: Meine Inhalte (`/content?tab=my`) → Meine Lektionen → ein Set mit
MEHREREN Lektionen (z. B. nach einem Buch-Import) → "Lektionen verwalten".

- [ ] Vorbereitung: Buch importieren/erzeugen (mehrere Lektionen in einem
      Set) ODER ein mehrlektioniges eigenes Set; 1-2 Lektionen spielen
      (Fortschritt + Wiederholungskarten erzeugen)
- [ ] "Lektionen verwalten" klappt die Einzel-Lektionsliste auf; jede
      Lektion hat Abspielen + Löschen
- [ ] Löschen öffnet einen Bestätigungsdialog, der die Lektion benennt
      und sagt, dass es NICHT rueckgaengig gemacht werden kann
- [ ] Häkchen "Auch meinen Lernfortschritt löschen" zeigt die ECHTE
      Karten-Anzahl der Lektion (nicht rueckgaengig)
- [ ] Löschen OHNE Häkchen: Lektion verschwindet aus der Liste,
      lesson_count sinkt, Geschwister-Lektionen bleiben unverändert;
      Fortschritt der gelöschten Lektion bleibt (verwaist, später
      aufraeumbar)
- [ ] Löschen MIT Häkchen: Fortschritt + Wiederholungskarten NUR dieser
      Lektion sind weg, Geschwister-Fortschritt bleibt
- [ ] Keine Umnummerierung: die verbleibenden Lektionen behalten ihre
      Titel/Reihenfolge, Deep-Links auf sie funktionieren weiter
- [ ] Letzte Lektion eines Sets löschen entfernt das GANZE Set aus Meine
      Inhalte
- [ ] Dialog per Tastatur bedienbar: Löschen-Button ist fokussiert,
      Escape/Abbrechen schliesst
- [ ] BEIDE Modi prüfen: Desktop/Server (API) UND GitHub Pages (Dexie)
- [ ] Backup-Zeitpunkt: VOR dem Löschen ein Backup (.alb) erstellen →
      Lektion löschen → Backup importieren → die Lektion ist wieder da
      (korrekt: ein Backup ist eine Momentaufnahme, KEIN Bug)

### Mehrere Lektionen auf einmal löschen (#2065)

Ort: Meine Inhalte (`/content?tab=my`) → Meine Lektionen → ein Set mit
MEHREREN Lektionen → "Lektionen verwalten".

- [ ] Vorbereitung: mehrlektioniges eigenes Set (z. B. Buch-Import);
      bei 2-3 Lektionen Fortschritt + Wiederholungskarten erzeugen
- [ ] "Lektionen auswählen" schaltet einen Auswahlmodus ein: je Zeile
      erscheint ein Kontrollkaestchen, die Zeilenaktionen (Verschieben,
      Abspielen, Bearbeiten, Löschen) sind in diesem Modus ausgeblendet
- [ ] "Alle auswählen" setzt alle Häkchen, nochmal geklickt hebt sie
      auf; "N ausgewählt" zählt korrekt mit
- [ ] "N löschen" ist deaktiviert, solange nichts ausgewählt ist
- [ ] Löschen öffnet EINEN Bestätigungsdialog, der die ANZAHL benennt
      und sagt, dass es NICHT rueckgaengig gemacht werden kann; der Dialog
      empfiehlt sichtbar (ohne Zwang) vorher ein Backup
- [ ] Häkchen "Auch meinen Lernfortschritt löschen" zeigt die
      AGGREGIERTE ECHTE Karten-Anzahl über alle ausgewählten Lektionen
- [ ] Löschen OHNE Häkchen: genau die ausgewählten Lektionen
      verschwinden in EINEM Schritt, lesson_count sinkt entsprechend,
      NICHT ausgewählte Geschwister-Lektionen bleiben unverändert
- [ ] Reihenfolge: die verbleibenden Lektionen behalten ihre Reihenfolge
      (keine Umnummerierung), Deep-Links auf sie funktionieren weiter
- [ ] Löschen MIT Häkchen: Fortschritt + Wiederholungskarten NUR der
      ausgewählten Lektionen sind weg, Geschwister-Fortschritt bleibt
- [ ] ALLE Lektionen auswählen und löschen: der Dialog sagt VORHER, dass
      das GANZE Set gelöscht wird; danach ist das Set aus Meine Inhalte weg
- [ ] Dialog per Tastatur bedienbar: Löschen-Button ist fokussiert,
      Escape/Abbrechen schliesst; Kontrollkaestchen haben ein aria-label
- [ ] BEIDE Modi prüfen: Desktop/Server (API) UND GitHub Pages (Dexie)
- [ ] Backup-Zeitpunkt: VOR dem Löschen ein Backup (.alb) erstellen →
      mehrere Lektionen löschen → Backup importieren → die Lektionen sind
      wieder da (korrekt: ein Backup ist eine Momentaufnahme, KEIN Bug)
- [ ] iOS-Standalone (zum Homescreen hinzugefuegte PWA, Dexie-Modus):
      Auswahlmodus, Kontrollkaestchen und der Bestätigungsdialog sind mit
      dem Finger bedienbar; die Aktionsleiste bricht auf schmalem Display
      sauber um (kein Ueberlauf)

### Content-Repo trennen vs. Fortschritt löschen (#1651 / #1652)

Ort: Settings → Daten → Content-Repo-Liste → "Entfernen".

- [ ] Standard (Häkchen NICHT gesetzt): beruhigender Hinweis, dass der
      Lernfortschritt ERHALTEN bleibt und beim Wiederverbinden zurück-
      kommt
- [ ] "Fortschritt löschen"-Häkchen gesetzt: Warnung mit ECHTEN Zahlen
      (N Lektionen + M Wiederholungskarten, nicht rueckgaengig)
- [ ] Nur trennen → dasselbe Repo wieder verbinden → Fortschritt wieder da
- [ ] Trennen + löschen → wieder verbinden → Fortschritt leer
- [ ] Häkchen erscheint nur wenn es Fortschritt zu löschen gibt
      (Dexie-Modus)

### Empfohlene Repositories: Buttons pro Zeile (#2558)

Ort: Settings → Daten → Empfohlene Repositories.

- [ ] Mehrere Empfehlungen sichtbar → "Repository hinzufügen" bei EINER
      klicken → NUR dieser Button wird deaktiviert, die anderen bleiben
      klickbar
- [ ] Während des Hinzufügens erscheint ein Fortschrittsanzeige (Label +
      Balken sobald die Sync-Phase Zahlen liefert) direkt bei der
      geklickten Zeile, nicht global
- [ ] Zweite Empfehlung während des Ladens der ersten klicken → beide
      laufen unabhängig durch, keine Fehlermeldung
- [ ] Nach Abschluss: Zeile verschwindet aus "Empfohlen" (jetzt in
      "Meine Content-Repositories"), Button-Zustand der übrigen Zeilen
      unverändert

### Social Sharing (visuell + nativ)
- [ ] Share-Button nach Lektion sichtbar
- [ ] Mobile: native Share-Sheet (WhatsApp/Telegram)
- [ ] Desktop: kopiert in Zwischenablage + Toast
- [ ] PNG Share-Card: sieht gut aus (1200x630, Theme-Tokens)

---

## PRIO 5: AI FEATURES (braucht echten API-Key)

- [ ] Provider-Tabelle: Key eingeben → "Testen" → "Verbindung ok"
- [ ] "Übungen generieren" bei theory-only: AI liefert Ergebnis
- [ ] Qualität der generierten Exercises: sinnvoll? Typenvielfalt?
- [ ] "Sitzung fortsetzen" nach Chat-Import: AI kennt den Kontext
- [ ] Tutor-Chat (assistant-ui, #1126): tippen → senden (oder Enter), die
      Antwort streamt herein; die 7-Schritt-Cycle-Progress rueckt vor;
      Vorlesen + Diktat funktionieren; das Fortsetzen einer regulaeren
      Sitzung zeigt den bisherigen Gespraechsverlauf
- [ ] Importierte Sitzung: die KI beginnt von selbst mit der ersten Frage
      (kein User-Turn zuerst), der Chat startet leer
- [ ] AI Content Validation: Report sinnvoll? Provider+Modell angezeigt?
- [ ] Kein Button ohne Key führt zu Error-Toast (disabled + Tooltip)

### Stapel-Generierung "Übungen für alle Lektionen" (#1896)
- [ ] Meine Inhalte → Meine Lektionen, Set in dem ALLE Lektionen bereits
      Übungen haben: Button "Übungen für alle Lektionen generieren" ist
      SOFORT deaktiviert, Tooltip "Alle Lektionen haben bereits Übungen."
      (kein Klick nötig, kein Info-Toast)
- [ ] Set mit mindestens EINER Lektion ohne Übungen: Button aktiv,
      Kosten-Bestätigung → Fortschritt → Ergebnis-Toast wie bisher
- [ ] Nach erfolgreichem Durchlauf (alle Lektionen fertig): Button wird
      ohne Reload deaktiviert

### KI-Schlüssel-Tresor Import (#1765 / #1769)
- [ ] Settings → KI → "Konfigurierte Provider" → "Importieren" springt zu
      Settings → Daten und scrollt den KeyVault-Import-Block sichtbar (#1765)
- [ ] Import per "Datei wählen" ODER Einfügen des rohen Envelope-JSON in
      das Textfeld; Passphrase immer erforderlich
- [ ] Kaputtes/unvollstaendiges JSON → Inline-Fehler (aria-live), Import
      bleibt deaktiviert
- [ ] Nach erfolgreichem Import (Datei ODER Einfügen): Wechsel zu
      Settings → KI zeigt den Key SOFORT, ohne Reload (#1769)
- [ ] Passphrase maskiert mit Reveal-Toggle; Key/Passphrase nie geloggt

### Cross-App-Tresor-Import (Topos → Adaptive Learner) (#2512)
- [ ] Eine in Topos exportierte .alk-Datei (Format "topos-ai-keys")
      importiert ohne "Fremd-Datei"-Ablehnung; die Passphrase der DATEI
      wird abgefragt
- [ ] Der Topos-Key unter "google" landet nach dem Import auf dem
      Provider "Gemini" (Settings → KI zeigt ihn dort)
- [ ] Falsche Passphrase → Warnung, kein Key wird geschrieben
- [ ] AL-Export unverändert: exportierte Datei trägt weiter das Format
      "adaptive-learner-keys"

### Perplexity-Provider (OpenAI-kompatibel, nur Server-Modus) (#2512)
- [ ] Settings → KI: "Perplexity" erscheint in der Provider-Auswahl
      (nach Gemini)
- [ ] Server-Modus (make dev): pplx--Key speichern, Modell-Picker zeigt
      die statische sonar-Liste (sonar, sonar-pro, sonar-reasoning)
- [ ] Server-Modus: Session-Nachricht mit aktivem Perplexity liefert
      eine Antwort (Modell sonar-pro als Default)
- [ ] Browser-Modus (Dexie/PWA): Perplexity ist sichtbar, aber als
      "nur Desktop" markiert (kein toter Menüpunkt, kein CORS-Fehler)

---

## PRIO 6: THEMES (subjektive Aesthetik)

Für JEDES Theme einmal durchklicken:
- [ ] Light: lesbar, Kontraste
- [ ] Dark: lesbar, App-Icon helle Variante
- [ ] Ocean, Forest, Sepia, High-Contrast
- [ ] Catppuccin Mocha, Soft Pop, Amethyst Haze
- [ ] Buttons kontrastreich auf ALLEN Themes?
- [ ] Dropdowns: opaker Hintergrund (nicht transparent)?
- [ ] Share-Card: Theme-Tokens korrekt?

---

## PRIO 7: GERAETE-SPEZIFISCH (nicht scriptbar)

### iPhone Safari
- [ ] "Zum Home-Bildschirm" → App-Icon korrekt
- [ ] PWA startet im Dexie-Modus
- [ ] Safe-Area Insets respektiert
- [ ] Mobile Nav = Hamburger-Drawer (Bottom Tab Bar wurde in #1512
      entfernt); Drawer-Links 44px, schliesst nach Navigation
- [ ] Bekanntes offenes Issue #1569 (Caret/Touch 1-2 Zeilen versetzt
      im Lesson-Flow): reproduzieren + Notizen ans Issue

#### Theorie-Vorlesen auf iOS: langer Text (#1928) - PFLICHT

iOS Safari bricht eine ungestueckelte Sprachausgabe nach ~15 Sekunden ab.
Seit #1928 wird ein Theorie-Block in Stücke zerlegt und als Warteschlange
gesprochen. Gemessen: 617 von 621 Theorie-Läufen liegen über der
Stueckgrenze, ein mittlerer Lauf hat 1551 Zeichen.

- [ ] Auf dem iPhone eine Lektion mit langem Theorie-Text öffnen,
      Vorlesen starten
- [ ] Der Text wird **vollständig** vorgelesen und bricht nicht nach
      ~15 Sekunden ab
- [ ] Beim mehrteiligen Theorie-Block schaltet die Lektion während des
      Vorlesens automatisch zum nächsten Schritt weiter (die Stueckelung
      darf die Position im Text nicht verfaelschen)
- [ ] Zwischen den Stuecken entsteht kein hoerbares Stocken
- [ ] Bekanntes Plattform-Limit, KEIN Fehler: Pause/Fortsetzen wirkt auf
      iOS Safari nicht (dort stoppt + startet die App neu)

#### App-Update als installierte iOS-PWA (#1357 / #1873) - PFLICHT

Der einzige Pfad, den kein Test abdeckt: auf iOS/WKWebView aktiviert
ein neuer Service Worker sich oft NICHT durch skipWaiting + Reload,
sondern erst nach vollstaendigem Schliessen und Neuoeffnen der App.

- [ ] PWA auf dem Home-Bildschirm installieren, Build-Hash unter
      Einstellungen > Über notieren
- [ ] Neuen Build deployen, App aus dem Hintergrund zurueckholen
      (nicht neu starten): Update-Banner erscheint
- [ ] Banner zeigt ZUSAETZLICH den Hinweis "Schliesse die App und
      oeffne sie neu" - dieser Hinweis darf auf iOS-Standalone nie
      fehlen
- [ ] "Aktualisieren" tippen: Banner verschwindet und kommt auch nach
      Reload NICHT wieder (Accept-Unterdrueckung)
- [ ] App vollständig schliessen und neu öffnen: Build-Hash unter
      Über ist der neue
- [ ] Auf einem NICHT-iOS-Gerät (Android/Desktop) denselben Ablauf:
      der Neustart-Hinweis darf dort NICHT erscheinen

#### "Was ist neu"-Hinweisfenster bleibt schließbar (#2266)

Das "Was ist neu"-Fenster des Update-Banners im Desktop-/API-Modus
(`DesktopUpdateHost`) darf die Nutzerin nie einsperren, egal wie hoch die
Release- und Installationshinweise sind. Die Sichthöhe ist bei einem
kurzen Fenster am kritischsten, deshalb die iOS-Standalone- bzw.
Hochformat-Situation ausdrücklich prüfen.

- [ ] Im API-/Desktop-Modus mit verfügbarem Update im Banner "Was ist
      neu?" öffnen - das Fenster erscheint mit Titel, scrollbarem Inhalt
      und einem stets sichtbaren X in der Kopfzeile
- [ ] Lange Hinweise: der Inhalt scrollt; das X in der Kopfzeile und der
      "Schließen"-Knopf in der Fußzeile bleiben erreichbar (die Hinweise
      schieben die Aktionen nie aus dem Bild)
- [ ] Auf vier Wegen schließen, jeder wirkt: das X in der Kopfzeile, der
      "Schließen"-Knopf, die Escape-Taste und ein Klick auf den
      Hintergrund außerhalb der Karte
- [ ] Ein Klick INNERHALB der Karte schließt sie NICHT
- [ ] Kurzes Fenster / iOS-Standalone: das Fenster auf Hochformat-Höhe
      verkleinern (oder eine installierte iOS-Standalone-Ansicht) - das X
      bleibt fest in der Kopfzeile, während die Hinweise scrollen; das
      Fenster ist weiter über X, Escape und einen Hintergrund-Tipp
      schließbar. Mit eingeblendeter Bildschirmtastatur wiederholen
- [ ] Tastatur/Screenreader: der Fokus wandert beim Öffnen in das
      Fenster, Tab bleibt darin, und der Fokus kehrt beim Schließen zum
      "Was ist neu?"-Knopf zurück (keine Axe-Regression)

### Android Chrome
- [ ] "App installieren" → Maskable Icon nicht abgeschnitten
- [ ] PWA funktioniert, Dexie-Modus

### Desktop PWA
- [ ] Install-Prompt → App startet standalone
- [ ] Dexie-Modus (NICHT API-Modus, keine 404)

---

## PRIO 8: SERVER-MODUS (via Launcher)

- [ ] Set herunterladen → in "Meine Inhalte" sichtbar (kein Cache-Problem)
- [ ] Backup-Import: kein HTTP 413
- [ ] Lektion durchspielen: keine workbox Fehler in der Konsole
- [ ] Port wechseln → App erreichbar auf neuem Port

---

## PRIO 9: LANDESEITE (statisch, #2409)

Die Landeseite unter `/start/` (DE) und `/start/en/` (EN) ist echtes
statisches HTML im Pages-Artefakt - kein React, kein Nachladen. Sie trägt
bewusst keine Zahlen, die veralten könnten.

- [ ] `astrapi69.github.io/adaptive-learner/start/` laedt; Kernsatz "Eine
      App, die sich dir anpasst, nicht umgekehrt." als Ueberschrift sichtbar.
- [ ] "App im Browser öffnen" führt zur App; "Launcher herunterladen"
      führt zur Release-Seite.
- [ ] Sprachwechsel: "English" oben rechts führt auf `/start/en/`, dort
      führt "Deutsch" zurück.
- [ ] Verweise unten (Dokumentation, Repository, Lerninhalte) funktionieren.
- [ ] Dunkles System-Theme: Seite folgt (prefers-color-scheme), Text lesbar.
- [ ] Mobil (schmales Fenster): einspaltig, kein horizontales Scrollen.
- [ ] Teilen-Vorschau (z. B. in einem Messenger): Titel, Beschreibung und
      Bild erscheinen (Open-Graph-Daten der Landeseite, nicht der App).

---

# TEIL B: AUTOMATISIERTE TESTS (Referenz)

Diese Tests laufen in CI oder via `make test`.
Hier nur zur Dokumentation was abgedeckt ist.

---

## Automatisiert: Unit + Component Tests (Vitest, 7200+;
## aktuelle Zahl siehe docs/audits/current-coverage.md)

Abdeckung:
- Alle Exercise-Typen (Matching, Cloze, Free Text, Word Tiles, Picture Choice)
- Answer Toggle (Meine Antwort / Auflösung) für alle Typen
- Lern-Modi Configs (MODE_CONFIGS Korrektheit)
- SRS-Algorithmus
- Backup Export/Import Serialisierung
- Content-Loader (Download, Parse, Cache)
- GitHub Repo Export (manifest.yaml, search-index.json Round-Trip)
- Share-Text Builder + Share-Card Generator
- Feature-Strategy (useFeatureAvailable Hook)
- i18n Parity (alle 11 Sprachen, kein fehlender Key)
- No-Hardcoded-Colors Guard
- Complexity Gate
- File-Size / Dir-Size Gates
- Docs-Discipline Gate

Ausführen: `make test` oder `cd frontend && npm test`

---

## Automatisiert: Backend + Plugin Tests (pytest, 2400+;
## aktuelle Zahl siehe docs/audits/current-coverage.md)

Abdeckung:
- FastAPI Endpoints (alle CRUD Operationen)
- Content-Loader Plugin (Download, Cache, list_sets)
- Gamification Plugin (XP, Level, Badges)
- AI Plugins (Anthropic, OpenAI, Gemini) mit Mocks
- Assessment Plugin (Profil, Fortschritt)
- Session Plugin
- Tracking Plugin
- Backup Export/Import API
- Alembic Migrations (Schema-Konsistenz)
- Plugin-Lock Parity

Ausführen: `make test` (Backend-Teil)

---

## Automatisiert: Dexie-Smoke E2E (Playwright TS, 45 Spec-Dateien)

Abdeckung:
- Vollständiger Lesson-Playthrough (alle Exercise-Typen)
- Content Hub Tabs (Entdecken, Meine Inhalte, Import)
- Dashboard Tabs
- Navigation (Desktop + Mobile)
- Settings
- Backup Round-Trip (programmatisch)
- Alle Routes erreichbar (kein 404)
- Karten-Bild-Upload: echtes File-Input + Canvas-Encoding, Vorschau,
  Entfernen, Fehler bei falschem Typ, Asset-Pfad-Toggle
  (`card-image-upload.spec.ts`, #1763/#1764)
- Multiple-Choice Single/Multi-Umschalter im Inline-Editor
  (Radio<->Checkbox, zweite Korrekt-Option, Kollaps beim Zurueckschalten)
  (`mc-single-multi-toggle.spec.ts`, #1888)
- Lektions-Zusammenfassung zeigt genau EINEN Favoriten-Button
  (`lesson-summary-favorite.spec.ts`, #1649)
- Lektionen kombinieren: Auswahl -> Dialog -> neues Set persistiert,
  Originale bleiben erhalten (`combine-lessons.spec.ts`, #1741)

Ausführen: `make test-dexie-smoke`

---

## Automatisiert: Manual-Automation E2E (Playwright TS, 18)

Abdeckung:
- Matching Resolution Flow
- Content Hub Navigation
- Keyboard Shortcuts
- Session Flows (Mobile + Desktop)
- Critical Surfaces

Ausführen: `make test-manual-automation`

---

## Automatisiert: Launcher Tests (pytest, 430+)

Abdeckung:
- actions.py: Docker-Check, Status, Install, Start, Stop, Uninstall
- Port-Validierung, Free-Port-Finder
- Config Load/Save Round-Trip
- Install-Manifest CRUD
- Cleanup (find_stale, cleanup_stale)
- Health-Check Logik
- CLI-GUI Parität
- i18n Key Parity (DE/EN)
- Frozen-Binary Erkennung
- Cross-Platform Port-Check (Windows SO_EXCLUSIVEADDRUSE)

Ausführen: `cd launcher && poetry run pytest` oder `make launcher-test`

---

## Automatisiert: Accessibility (axe-core, in Dexie-Smoke)

Abdeckung:
- Dashboard: keine kritischen Violations
- Settings: keine kritischen Violations
- Content: keine kritischen Violations

Erweiterung geplant: alle 15 Sektionen

---

## Automatisiert: Visual Regression (Feature-Screenshots)

Abdeckung:
- Dashboard Tabs (Desktop + Mobile)
- Content Hub Tabs
- Matching Animation
- Lesson Modes
- Answer Toggle
- GitHub Export Dialog

Ausführen: `make capture-screenshots` / `make verify-screenshots`

---

## Automatisiert: CI Gates (bei jedem PR)

- tsc --noEmit (TypeScript Compiler)
- eslint --max-warnings 0
- ruff check + ruff format (Backend)
- mypy --strict (Backend)
- i18n Parity
- No-Hardcoded-Colors
- Complexity Gate (.complexity-baseline)
- File-Size Gate (.filesize-baseline)
- Dir-Size Gate (.dirsize-baseline)
- Docs-Discipline
- Version-Lockstep (19 Dateien)
- Plugin-Lock Parity

---

# ERGEBNIS

```
Datum:
Tester:
Geraet + Browser:
Version:

MANUELLE TESTS:
  Getestet: ___ / ___
  OK:       ___
  BUG:      ___
  SKIP:     ___

  Kritische Bugs (Launch-Blocker):
  1.

  Mittlere Bugs:
  1.

  Kosmetische Bugs:
  1.

AUTOMATISIERTE TESTS (Soll-Zahlen: docs/audits/current-coverage.md):
  Vitest:       ___ gruen
  Backend:      ___ gruen
  Dexie-Smoke:  ___ gruen
  Launcher:     ___ gruen
  CI Gates:     alle gruen? [ ]

Fazit: LAUNCH-READY / NICHT LAUNCH-READY
```
