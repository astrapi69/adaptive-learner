# Manueller Testplan - Adaptive Learner v2.3.0+

Stand: 18.07.2026 (Session 6, nach dem v2.3.0-Release)
Tester: Aster + Beta-Tester

Navigations-Hinweis: Der Content-Bereich ist ein Tab-Hub unter `/content`
(`?tab=discover` = Entdecken, `?tab=my` = Meine Inhalte, `?tab=import` =
Import). Die alten Routen `/discover` + `/import` leiten weiter. **Meine
Lektionen**, der **Lektion-Import**, **Bearbeiten**, **Als Datei speichern**
und **Zu Set kombinieren** liegen alle im Tab **Meine Inhalte** (`?tab=my`).
Backup + KI-Schluessel-Tresor (KeyVault) liegen unter **Settings → Daten**;
die Provider-Uebersicht unter **Settings → KI**; Content-Repos unter
**Settings → Daten**.

Struktur:
- TEIL A: Was DU manuell testen musst (nach Prioritaet)
- TEIL B: Was automatisiert ist (Referenz, nachtraeglich pruefbar)

Fuer jeden manuellen Testfall: OK / BUG (Screenshot + Browser + Beschreibung)

---

# TEIL A: MANUELLE TESTS (Aster)

Sortiert nach Prioritaet. Launch-Blocker zuerst.

---

## Manuelle Geraete-QA - Konsolidierte Checkliste (Stand 25.07.2026)

Alles hier kann NUR manuell erledigt werden. Zwei Sessions, einmal iPhone,
einmal Ubuntu.

### Session A: iPhone (iOS PWA/Standalone)

Voraussetzung: #2050 gemerged, aktueller develop-Stand deployed (bzw.
Preview).

#### A1. BACKUP-AKZEPTANZTEST (Launch-Gate, seit fruehen Sessions offen)

Echter Round-Trip, keine Simulation:

- [ ] App im Standalone-Modus mit realen Daten: mindestens ein importiertes
      Set, Lernfortschritt in mehreren Lektionen, ein Set auf
      "zurueckgestellt" (deferred), ein Set abgeschlossen, eigene Uebung
      angelegt.
- [ ] Backup exportieren (.alb), Datei nachweislich ausserhalb der App
      sichern (Dateien-App/AirDrop).
- [ ] Harter Wipe: App-Daten vollstaendig loeschen (Safari-Websitedaten fuer
      die Domain entfernen, App neu installieren/oeffnen - das ist die echte
      WKWebView-Eviction, nicht `localStorage.clear()`).
- [ ] Frischen Zustand verifizieren: App leer.
- [ ] Backup importieren.
- [ ] Pruefen: Lernfortschritt vorhanden, Deferred-Markierung vorhanden (der
      #2050-Pfad!), abgeschlossenes Set korrekt, eigene Uebung vorhanden,
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

#### A4. Lektion loeschen (#2064, gemerged) - ueberschneidet sich mit A1

Dieses Feature verlangt laut Testplan beide Speichermodi plus
Backup-Round-Trip inklusive iOS-Standalone. Das ist in der Substanz
derselbe Ablauf wie A1. Beides in einem Durchgang erledigen (siehe auch
den Abschnitt "Einzelne Lektion loeschen (#2064)" weiter unten):

- [ ] In "Meine Inhalte" eine Lektion mit vorhandenem Lernfortschritt
      loeschen.
- [ ] Bestaetigungsdialog pruefen: Nennt er den Lernfortschritt (gelernte
      Karten), nicht nur die Uebungszahl?
- [ ] Nach dem Loeschen: Lektion weg, keine verwaisten Karten in der
      Wiederholung, Favorit entfernt, Nummerierung mit Luecke wie
      entschieden.
- [ ] Backup von VOR dem Loeschen importieren: Lektion kommt zurueck (Backup
      ist ein Zeitpunkt, so entschieden). Das ist erwartetes Verhalten, kein
      Fehler.
- [ ] Beide Speichermodi.

#### A5. Wizard-Schritt-Reset (#2061, gemerged) - kurz, auch am Desktop moeglich

- [ ] Buch-Set oeffnen, "Lektion bearbeiten", zu Schritt 2 navigieren.
- [ ] Im Dropdown ein anderes Kapitel waehlen: Schritt 2 bleibt, Uebungen der
      neuen Lektion erscheinen.
- [ ] Randfaelle: Wechsel zu einer Lektion ohne Uebungen, Rueckwaertswechsel.

#### A6. Lektionsreihenfolge verschieben (#2172, gemerged)

Die Anzeigereihenfolge ist ein eigenes Feld; Verschieben aendert die
Sortierung, nie die Identitaet einer Lektion. iOS-Standalone ist der heiklere
Fall (Verschieben auf dem Telefon).

- [ ] In "Meine Inhalte" ein mehrlektionales (Buch-)Set aufklappen ->
      "Lektionen verwalten".
- [ ] Je Lektion sind Auf/Ab-Bedienelemente sichtbar. Beim ersten Eintrag ist
      "Auf" deaktiviert, beim letzten "Ab" deaktiviert (kein wirkungsloses
      Klicken).
- [ ] Nur mit der Tastatur bedienbar: mit Tab zum Auf/Ab-Element, mit
      Leertaste/Enter ausloesen. Der Screenreader liest eine verstaendliche
      Bezeichnung ("Lektion X nach oben verschieben") und nach dem Verschieben
      die neue Position ("X ist jetzt an Position n von m").
- [ ] Reihenfolge ist SOFORT gespeichert - keine gesonderte Speichern-Aktion.
      Seite neu laden (oder Set zu- und wieder aufklappen): die geaenderte
      Reihenfolge bleibt.
- [ ] Wirkt auf die LERNFOLGE (#2212), nicht nur die Liste: nach dem
      Verschieben öffnet das Set mit der neuen ersten Lektion, und die
      Weiter-Navigation ("nächste Lektion") folgt der gewählten Reihenfolge -
      in beiden Speichermodi.
- [ ] Bestehende Sets: ohne eigenes Verschieben zeigt sich die bisherige
      Reihenfolge unveraendert (kein stilles Umsortieren).
- [ ] Identitaet unberuehrt: nach mehreren Verschiebungen einer Lektion mit
      vorhandenem Lernfortschritt bleibt der Fortschritt zugeordnet, keine
      verwaisten Wiederholungskarten, Loeschen trifft weiter die richtige
      Lektion.
- [ ] Backup-Round-Trip: Export -> Speicher leeren -> Import bringt die
      gewaehlte Reihenfolge zurueck.
- [ ] Beide Speichermodi (API + Dexie).
- [ ] iOS-Standalone (PWA vom Home-Bildschirm): Verschieben per Touch und die
      Positions-Rueckmeldung funktionieren, Reihenfolge bleibt nach dem
      Schliessen und Wiederoeffnen.

#### A6b. Importreihenfolge folgt der Quelle (#2173, gemerged)

Nach einem Buch-/Text-Import stehen die Lektionen in Quell-/Kapitelreihenfolge,
nicht alphabetisch nach Titel (frueher: Epilog vor Kapitel 1). Die Reihenfolge
wird beim Import in denselben Overlay-Speicher wie das Verschieben (#2172)
geschrieben; Dateinamen/Identitaeten bleiben unberuehrt. Der heikle Fall ist
die Herkunft: eine eigene Verschiebung des Nutzers darf ein erneuter Import
NICHT ueberschreiben.

- [ ] Ein Buch mit Kapiteln importieren, deren Titel alphabetisch NICHT der
      Kapitelfolge entsprechen (z. B. ein "Epilog" oder "Anhang"). Nach dem
      Import zeigt "Lektionen verwalten" die Kapitel in Buchreihenfolge, nicht
      alphabetisch.
- [ ] Wirkt auf die LERNFOLGE, nicht nur die Liste: das Set oeffnet mit der
      ersten Quell-Lektion, die Weiter-Navigation folgt der Quellreihenfolge -
      in beiden Speichermodi (API + Dexie).
- [ ] Identitaet unberuehrt: Lernfortschritt/Wiederholungskarten bleiben
      zugeordnet (keine Umnummerierung der Dateinamen).
- [ ] Nutzer gewinnt: eine Lektion von Hand verschieben, dann dasselbe Buch
      erneut importieren (bzw. Inhalt aktualisieren). Die eigene Reihenfolge
      bleibt erhalten, wird NICHT still zurueckgesetzt.
- [ ] Neue Lektionen bei erneutem Import nach eigenem Verschieben landen am
      Ende (sichtbar, nicht eingestreut); entfernte Lektionen verschwinden,
      die uebrige gewaehlte Reihenfolge bleibt.
- [ ] Bestehende (vor #2173 importierte) Sets werden nicht automatisch
      umsortiert; der Nutzer zieht sie ueber "Lektionen verwalten" (#2172)
      gerade.
- [ ] Backup-Round-Trip: Export -> Speicher leeren -> Import bringt die
      Reihenfolge zurueck.
- [ ] iOS-Standalone (PWA vom Home-Bildschirm): frisch importiertes Buch in der
      installierten PWA oeffnen - die Kapitel stehen in Buchreihenfolge, und
      eine eigene Verschiebung ueberlebt ein Schliessen und Wiederoeffnen.

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

- [ ] Daemon laeuft + Testnutzer OHNE docker-Gruppe (qatest):
      Permission-Meldung + pkexec-Fix-Angebot, NICHT "Docker starten". [seit
      dem 0.16.0-Fehlschlag ohne realen Beweis]
- [ ] pkexec-Fix ausfuehren, echte Neuanmeldung: Zustand wechselt zu "Docker
      laeuft".
- [ ] Konsole sichtbar, Detection-Zeilen streamen, Text-Wrap korrekt, Fenster
      resizable.
- [ ] Branding "Adaptive Learner", About: App 2.8.2 mit Quellen-Label; die
      angezeigte Launcher-Version notieren (Ist-Wert aus dem v2.8.2-Binary).
- [ ] Setup laeuft durch bis zum erreichbaren App-Frontend im Browser.
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
Backup-Round-Trip, A2 und A5 sind kurze Zusatzpruefungen. Damit faellt in
einer Sitzung das aelteste Launch-Gate zusammen mit zwei frisch gemergten
Features. Session B erst, wenn die neuen Binaries vorliegen.

---

## PRIO 1: BACKUP-AKZEPTANZTEST (Launch-Gate!)

**Neuer Testfall unter PRIO 1 Backup-Akzeptanztest:**
- [ ] GitHub Pages: Backup erstellen
- [ ] Lokal installieren (Launcher)
- [ ] .alb von GH Pages importieren → alles uebernommen

Dieser Test ist seit Session 2 als Launch-Gate definiert.
Noch nie durchgefuehrt. JETZT machen.

- [ ] Daten erzeugen: mindestens 2 Sets herunterladen, 3 Lektionen starten, Theme wechseln
- [ ] Export: Settings → Daten → Backup erstellen → .alb Datei herunterladen
- [ ] Dateigrösse pruefen (sollte >1MB sein wenn Sets geladen)
- [ ] Browser-Daten KOMPLETT loeschen:
      DevTools → Application → Storage → "Clear site data"
      UND: IndexedDB "adaptive-learner" loeschen
      UND: localStorage.clear()
- [ ] App oeffnen → Onboarding → "Backup wiederherstellen"
- [ ] .alb Datei auswaehlen → Import startet
- [ ] KEIN HTTP 413 Fehler (nginx 50MB Limit gefixt)
- [ ] Sets vorhanden (Meine Inhalte → alle zuvor geladenen Sets)
- [ ] Fortschritt erhalten (gestartete Lektionen, Scores)
- [ ] Settings korrekt (Theme, Sprache, Voice-Einstellungen)
- [ ] Lern-Modi Einstellungen erhalten
- [ ] XP + Level korrekt
- [ ] Legacy .json Import: altes Backup-Format → funktioniert
- [ ] API-Keys NICHT im Backup (Sicherheits-Check)
- [ ] Nach Restore: Provider-Uebersicht (Settings → KI) zeigt wieder-
      hergestellte Einstellungen OHNE Reload (settings-refresh-bus, #1769)

---

## PRIO 2: LAUNCHER (Desktop)

### Grundfunktion (Ubuntu)
- [ ] `python3 -m adaptive_learner_launcher --debug` → EIN Fenster oeffnet
- [ ] Fenster verschwindet NIE von selbst
- [ ] Docker-Check als erster Schritt (Hinweis wenn Docker nicht laeuft)
- [ ] Live-Fortschritt bei Install im Log-Bereich (Zeile fuer Zeile)
- [ ] "Image bauen..." sichtbar (nicht stiller Hintergrund)
- [ ] Am Ende: "App ist bereit." in gruen

### Port
- [ ] Port-Feld sichtbar (Default 8501)
- [ ] Port editierbar wenn gestoppt/nicht installiert
- [ ] Port read-only wenn laeuft
- [ ] Port WECHSELN: 8501 → 9000 → App erreichbar auf 9000
- [ ] Port-Indikator: gruen wenn laeuft (nicht rot)

### Portwechsel: Datenmitnahme (#2069)
- [ ] Servermodus (Default): Daten anlegen, Port wechseln, neu oeffnen → Sets + Fortschritt weiter da (Backend-Daten ueberleben; auf der Landing-Seite via identity.yaml automatisch wiederhergestellt)
- [ ] Browser-Speichermodus (Einstellungen > Daten > Speichermodus): Daten anlegen, Port wechseln, neu oeffnen → leere App mit Hinweis "Hast du Adaptive Learner schon einmal unter einem anderen Port genutzt?" auf dem Willkommensbildschirm (Daten NICHT geloescht, nur an den alten Origin gebunden)
- [ ] Der Hinweis verlinkt auf die Hilfeseite "Den Port aendern"
- [ ] Wiederherstellung (Browser-Modus): zurueck zum alten Port → Einstellungen > Daten > Backup exportieren (`.alb`) → neuer Port → "Aus Backup wiederherstellen" → Sets, Fortschritt, Uebungen, Einstellungen wieder da
- [ ] Kanonische Web-Version (astrapi69.github.io, Browser-Modus, kein expliziter Port): der Hinweis erscheint NICHT

### Zustaende
- [ ] Nicht installiert: [Installieren] sichtbar
- [ ] Laeuft: [Im Browser oeffnen] [Stoppen] [Deinstallieren]
- [ ] Gestoppt: [Starten] [Deinstallieren]
- [ ] Alle Buttons komplett sichtbar (620px breit, kein Abschneiden)

### Deinstallieren
- [ ] Verbose Output: jeden Container/Image einzeln mit ✓/✗
- [ ] Image-Groessen angezeigt
- [ ] Summary: "X Artefakte entfernt, Y MB freigegeben"
- [ ] Zustand wechselt zu "Nicht installiert"

### Cleanup beim Start
- [ ] Findet verwaiste Artefakte (falls vorhanden)
- [ ] User kann auswaehlen (Lerndaten default AUS)
- [ ] Verbose Fortschritt

### Windows
- [ ] .exe startet (aus GitHub Release)
- [ ] Persistentes Fenster (KEINE Dialog-Kette!)
- [ ] Alle Funktionen wie auf Linux

---

## PRIO 3: CONTENT-QUALITAET (Native-Speaker Stichprobe)

Erfordert Domaenenwissen. Nicht automatisierbar.

- [ ] Deutsch-Englisch A1/B1: Uebersetzungen korrekt?
- [ ] KI-Einsteiger (DE): Fachbegriffe korrekt? Erklaerungen verstaendlich?
- [ ] Ansible QE: Kommandos korrekt? Syntax stimmt?
- [ ] Japanisch A1: Hiragana/Katakana korrekt? Romanisierung stimmt?
- [ ] Koreanisch A1: Hangul korrekt? Romanisierung stimmt?
- [ ] Chinesisch A1: Pinyin korrekt? Zeichen stimmt?
- [ ] Italienisch A1: Stichprobe Grammatik/Vokabeln
- [ ] Portugiesisch-BR A1: Stichprobe

---

## PRIO 4: LERNEN - MANUELLE UX-PRUEFUNG

### Uebungstypen (visuell pruefen)
- [ ] Matching: Paare GLEICHE Hoehe (kein visueller Versatz)
- [ ] Matching: "Aufloesen" Animation sieht gut aus (4 Effekte testen)
- [ ] Word Tiles: Korrektur LESBAR (Leerzeichen, kein "DasGehirnvergisst...")
- [ ] Free Text: Korrektur LESBAR (Token-Diff verstaendlich)
- [ ] Picture Choice: Kacheln GLEICHE Hoehe
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
- [ ] Schwierigkeits-Indikator (#1693): eine Uebung, deren Karte(n) eine
      authored `difficulty` (1-5) tragen, zeigt ueber der Uebung ein kleines
      Badge mit Stufenwort (Leicht/Mittel/Schwer) + 5-Punkt-Anzeige.
      Karten OHNE `difficulty` (der gesamte Alt-Bestand) zeigen KEIN Badge
      (die Uebung sieht aus wie vorher). Gilt fuer alle Uebungstypen
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
- [ ] Endlos: kein Session-Ende, Statistik laeuft
- [ ] Endlos-Abschluss ("Uebung beendet"): Enter (ohne Klick) loest
      "Zurueck zum Dashboard" aus (#1864, Button auto-fokussiert)
- [ ] Fehler-wiederholen-Abschluss ("Alle Fehler korrigiert!"): Enter
      (ohne Klick) loest "Zurueck zur Lektion" aus (#1864); Klick auf den
      Button funktioniert weiterhin
- [ ] Lektions-Zusammenfassung ("Geschafft: ..."): mit verfuegbarer
      naechster Lektion loest Enter (ohne Klick) die primaere Karte
      "Naechste Lektion -> Starten" aus - nicht eine sekundaere Karte
      (z. B. "Wiederholung"); Klick auf die Buttons funktioniert weiterhin
      (#1943)
- [ ] Letzte Lektion eines Sets (keine "Naechste Lektion"): auf der
      Zusammenfassung passiert bei Enter nichts Falsches - kein Fehler,
      keine Navigation zu einer nicht vorhandenen Lektion (#1943)
- [ ] Fehler wiederholen bei Zuordnung (#1874): Zuordnungs-Uebung mit
      gemischt richtigen/falschen Paaren spielen, "Fehler wiederholen"
      oeffnen -> nur die falschen Paare erscheinen (nicht alle). Bei nur
      einem falschen Paar werden korrekte Paare als Distraktoren aufgefuellt
      (mind. 2 Paare, damit ueberhaupt zugeordnet werden kann)
- [ ] Einstellung "Fehler wiederholen" (Settings -> Lernen): Umschalten auf
      "Ganzes Set wiederholen" -> beim naechsten "Fehler wiederholen"
      erscheinen tatsaechlich ALLE Paare; zurueck auf "Nur Fehler zeigen"
      (Standard) -> wieder nur die falschen
- [ ] Regression andere Typen: Freitext/Lueckentext bei "Fehler
      wiederholen" weiterhin nur die falschen Elemente

### Neue Uebungstypen (seit v2.2.0, visuell + funktional)
- [ ] multiple_choice: Auswahl, Feedback, SRS-Attempt
- [ ] ext:al-categorization: Kategorien zuordnen, Aufloesung lesbar
- [ ] ext:al-error-correction: Fehler finden + korrigieren
- [ ] ext:al-reading-comprehension: Text + Fragen
- [ ] ext:al-graded-quiz: Bewertung + Ergebnisanzeige
- [ ] ext:al-dictation (#1881): "Listen first" spielt den Clip, Transkription
      tippen; richtig / knapp daneben ("Almost!") / falsch zeigt die Loesung;
      eine Lektion mit `requires_extensions: ["ext:al-dictation@1"]` laedt
      (wird nicht vom Guard abgelehnt)
- [ ] ext:al-image-description (#2095): das Bild wird gezeigt, eine
      Freitext-Beschreibung tippen; richtig / knapp daneben ("Almost!") /
      falsch zeigt die Loesung; eine Lektion mit
      `requires_extensions: ["ext:al-image-description@1"]` laedt (nicht vom
      Guard abgelehnt). Ein eingebettetes Bild wird OHNE Netzverbindung
      angezeigt (Offline-First); eine Lektion mit einer entfernten
      `http(s)://`-Bild-URL wird vom Guard abgelehnt. Vorlesen: der Prompt hat
      einen Lautsprecher-Button (die Anweisung wird vorgelesen, nie die
      Antwort). a11y-Hinweis: dieser Typ ist bewusst visuell voraussetzungs-
      behaftet (die Antwort IST die Bildbeschreibung) - ein Screenreader hoert
      ein neutrales Bild-Label, nicht die Loesung.
- [ ] Listen-First-Audio (#1687): Audio-Button auf free_text +
      matching spielt ab, Grading unbeeinflusst

### Import/Export von Lektionen/Sets (#1672 / #1681 / #1685-Haertung)

Ort: Meine Inhalte (`/content?tab=my`) → "Lektion importieren"-Modal +
per-Karte "Exportieren" / "Als Set exportieren"; akzeptiert `.json` (eine
Lektion) + `.zip` (ganzes Set = `manifest.yaml` + `lessons/`).

- [ ] Import einer `.json`-Lektion: Vorschau zeigt Titel · Sprache · N
      Lektionen · M Uebungen VOR dem Bestaetigen
- [ ] Import eines `.zip`-Sets: Vorschau + korrekte Lektionszahl
- [ ] Namenskollision: Drei-Wege-Dialog erscheint (Ueberschreiben /
      Als Kopie importieren / Abbrechen), KEIN stilles Ueberschreiben;
      "Als Kopie" erzeugt neue id + "(Kopie)"-Titel
- [ ] Teil-Import (ZIP mit kaputten Lektionen): gueltige importieren,
      Warnung "N Lektion(en) uebersprungen" wird angezeigt
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
      (Metadaten → Buchtext → Review); Text einfuegen + Generieren → KI
      formuliert Theorie in eigenen Worten + erzeugt Uebungen; OHNE
      KI-Key: freundlicher Hinweis, kein Crash; "Weiter" erst nach
      erfolgreicher Generierung
- [ ] **Titel-Pflichtfeld im Buchtext-Pfad (#1946):** Schritt 1 OHNE
      Titel → Karte "Wissenslektion aus Text" klicken → bleibt auf
      Schritt 1 mit dem freundlichen Hinweis "Ein Titel ist
      erforderlich." (NICHT der Buchtext-Schritt, NICHT der rohe
      Schema-Fehler beim Speichern); mit Titel → Buchtext-Schritt
      oeffnet normal und Speichern gelingt
- [ ] **[MOBILE] Titel-Warnung wird sichtbar gescrollt (#2036):** iPhone /
      schmaler Viewport, Schritt 1 OHNE Titel, nach unten zum Weiter-Button
      scrollen (Titelfeld oben ausserhalb des Sichtbereichs) → Weiter
      druecken: die Ansicht scrollt zum Titelfeld, das Feld erhaelt den Fokus
      und ist als ungueltig markiert (roter Rahmen), der Hinweis "Ein Titel
      ist erforderlich." ist im Sichtbereich (KEIN Dead-End, keine Reaktion
      fehlt). Gilt fuer alle drei Einstiege: Weiter (Karten-Pfad), Karte
      "Wissenslektion aus Text" (Buch) und Karte "Erweiterungen" (Extension).
      Desktop-Regression: ist das Feld schon sichtbar, gibt es keinen
      Scroll-Sprung
- [ ] **Datei-Upload im Buchtext-Schritt (#1927):** Button "Aus Datei
      laden (EPUB, DOCX, TXT, MD)" ueber dem Textfeld; EPUB waehlen →
      Abschnittsliste erscheint (Checkboxen, Titel + Zeichenzahl);
      Markdown-Datei → Split an Ueberschriften; TXT ohne Ueberschriften
      → ein Abschnitt; kaputte/zu grosse Datei (> 20 MiB) → klare
      Fehlermeldung, kein Crash; Rechte-Hinweis erwaehnt Hochladen
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
      ankreuzbar (Hinweiszeile erklaert es); GENAU EIN Abschnitt gewaehlt
      → Button "In Textfeld uebernehmen" fuellt das Textfeld (bei
      vorhandenem Text: Bestaetigungsdialog "Ersetzen"), Vorschau sichtbar,
      danach normale Einzel-Generierung (Regression); MEHRERE Abschnitte
      gewaehlt → Button "N Lektionen generieren" startet die Batch-
      Generierung mit Fortschrittsanzeige ("Lektion 2 von 5 …") →
      eine Lektion pro Abschnitt, Reihenfolge = Dokumentreihenfolge (nicht
      Auswahlreihenfolge); Review zeigt "N Lektion(en)" + Titel-Liste;
      Speichern → ein Set mit N Lektionen; schlaegt eine Einzel-Generierung
      fehl, laufen die uebrigen weiter, Zusammenfassung nennt "X von N" +
      die fehlgeschlagenen Abschnitte; ohne AI-Key → Key-Hinweis, kein Batch
- [ ] **Lektion bearbeiten (#1740):** Meine Inhalte → Karte einer EIGENEN
      Lektion → Stift/Bearbeiten → Wizard oeffnet vorausgefuellt; Review
      zeigt "Aenderungen speichern" (ueberschreibt dieselbe id, Fort-
      schritt bleibt) + "Als Kopie speichern"; Fremd-Repo-Lektionen
      zeigen KEIN Bearbeiten; Analyse-Lektionen fuehren zur Import-Seite.
      **#2201:** "Als Kopie speichern" (und die Import-Kollision "Als
      Kopie importieren") zeigen den Hinweis, dass eine Kopie OHNE
      Lernfortschritt startet, während das Original seinen Fortschritt
      und seine Wiederholungskarten behält
- [ ] **Einfache Lektion (ohne Extension) bleibt speicherbar (#1919):**
      eine Lektion per Auto-Generieren erstellen (nur die sechs CORE-Typen,
      keine Extension-Uebung), lokal speichern → ueber Bearbeiten erneut
      oeffnen → zum Review blaettern: der Check "Gueltige Lektionsstruktur"
      ist GRUEN und "Aenderungen speichern" funktioniert (zuvor scheiterte
      es mit "ext_payload must be object" im API-/Server-Modus)
- [ ] **Buchtext-Lektion bearbeiten (#1967):** eine ueber "Wissenslektion
      aus Text" (Buchtext-Pfad) erstellte Lektion (Theorie + generierte
      Uebungen, KEINE Vokabelkarten) lokal speichern → ueber "Lektion
      bearbeiten" erneut oeffnen → "Weiter" fuehrt DIREKT zum Uebungs-Editor
      mit den tatsaechlich generierten Uebungen (NICHT dem leeren
      Vokabelkarten-Editor, der zuvor die Weiter-Schaltflaeche blockierte);
      der 3-Schritt-Fluss ist Metadaten → Uebungen → Review; Review hat
      KEINE "Mindestens 4 Karten"-Zeile und "Aenderungen speichern" ist
      aktiv; nach Speichern bleiben Theorie- und Uebungsschritte erhalten.
      Regression: eine normale Karten-Lektion (Vokabel-Liste) UND eine
      Extension-Lektion oeffnen weiterhin korrekt zum Bearbeiten
- [ ] **Kleine Buchtext-Lektion (< 5 Uebungen) bearbeiten (#1970):** eine
      Buchtext-Lektion, bei der der Generator nur wenige Uebungen erzeugt
      hat (z. B. 4, weil Wort-Kacheln/Bildauswahl/Multiple-Choice mangels
      Beispielsaetzen/Bildern uebersprungen wurden), lokal speichern → ueber
      "Lektion bearbeiten" oeffnen → ALLE gespeicherten Uebungen werden
      angezeigt; "Weiter" ist NICHT durch "5 Uebungen noetig" blockiert und
      "Aenderungen speichern" ist aktiv (die Mindestanzahl gilt nur fuer die
      Neuerstellung, nicht fuer das Bearbeiten einer bereits gueltigen
      Lektion); der irrefuehrende Hinweis "Wort-Kacheln/Bildauswahl/
      Multiple-Choice ergaben keine Uebungen" + der Generieren-Bereich
      erscheinen im Bearbeiten NICHT (keine Karten zum Generieren). WICHTIG:
      Bearbeiten-Oeffnen aendert die gespeicherte Datei NICHT (kein Auto-Save);
      es gehen keine Uebungen verloren
- [ ] **Set mit mehreren Lektionen bearbeiten (Lektions-Auswahl, #1971):** ein
      Set, das MEHRERE Lektionen enthaelt (z. B. ein Buchtext-Upload mit
      Mehrfach-Abschnitts-Auswahl → eine Lektion pro Abschnitt), ueber "Lektion
      bearbeiten" oeffnen → oben erscheint eine **Lektions-Auswahl** (Dropdown
      mit allen Lektionen des Sets); die erste Lektion ist vorausgewaehlt und
      ihre Uebungen sichtbar. Andere Lektion waehlen → deren Theorie/Uebungen
      werden geladen (vorher unerreichbar). Bei ungespeicherten Aenderungen vor
      dem Wechsel erscheint ein Bestaetigungsdialog ("Lektion wechseln?"). Eine
      Lektion bearbeiten + speichern → NUR diese Lektion wird ersetzt, die
      anderen bleiben erhalten, und der SET-Titel/Level/Sprachen aendern sich
      NICHT (werden nicht durch den Titel der bearbeiteten Lektion ueberschrieben).
      Regression: ein Set mit nur EINER Lektion zeigt KEINE Lektions-Auswahl
- [ ] **Lektionswechsel behaelt den Schritt (#2061):** ein Set mit mehreren
      Lektionen ueber "Lektion bearbeiten" oeffnen, zu **Schritt 2 (Uebungen)**
      navigieren (Uebungsliste sichtbar) → im Dropdown "Lektion in diesem Set"
      eine ANDERE Lektion waehlen → der Wizard BLEIBT auf Schritt 2, nur die
      Uebungsliste wechselt auf die gewaehlte Lektion (vorher: Ruecksprung auf
      Schritt 1, "Weiter" musste erneut gedrueckt werden). Gleiches auf
      Schritt 3 (Ueberpruefung): der Schritt bleibt erhalten. Randfaelle: Wechsel
      auf eine Lektion OHNE Uebungen zeigt eine leere Liste ohne Absturz und ohne
      Ruecksprung; bei ungespeicherten Aenderungen erscheint weiterhin zuerst der
      "Lektion wechseln?"-Bestaetigungsdialog. Desktop + iOS-Standalone pruefen
- [ ] **Buchangabe bleibt beim Bearbeiten erhalten (#1989):** eine Lektion ueber
      den Buchtext-Wizard MIT ausgefuellter "Buchangabe (optional)" (Titel,
      Autor, URL, ISBN/ASIN) erstellen + speichern → in der Lektion erscheint
      unter "Vertiefe das Thema" die Buchreferenz. Dann ueber "Lektion
      bearbeiten" oeffnen, etwas aendern, speichern → die Buchangabe ist
      WEITERHIN vorhanden (vorher: verschwand nach dem ersten Bearbeiten). Ueber
      MEHRERE Bearbeitungszyklen bleibt sie erhalten; auch "Als Kopie speichern"
      uebernimmt die Buchangabe. Regression: eine Lektion OHNE Buchangabe
      bekommt beim Bearbeiten KEIN leeres Buch-Objekt aufgezwungen
- [ ] **Alte englische Prompts migrieren beim Bearbeiten (#1860):** eine
      VOR #1855 erzeugte Alt-Lektion (Uebungsanweisungen fest englisch, z. B.
      "Match each word with its translation.") ueber "Lektion bearbeiten"
      oeffnen → die betroffenen Anweisungen erscheinen automatisch in der
      UI-Sprache + ein dezenter, schliessbarer Hinweis oben ("... automatisch
      in deine Sprache uebertragen"). NUR bei EXAKT dem alten Default: ein vom
      Nutzer bewusst abweichend gesetzter Prompt (auch zufaellig englisch)
      bleibt unveraendert. Editor ohne Speichern verlassen → Original in
      Dexie unveraendert (kein stiller Schreibvorgang); erst Speichern
      (Ueberschreiben/Als Kopie) schreibt die migrierte Fassung dauerhaft
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
      GER-Level werden angezeigt (wie bisher). Eine Wissensdomain waehlen
      (z. B. "Psychologie", "Programmierung", "Wissen") → das Sprachpaar
      klappt auf EINE "Inhaltssprache" zusammen (Quelle == Ziel), das Level
      bietet zusaetzlich "Kein Niveau", und ein Hinweis erklaert die
      Wissensinhalte. Inhaltssprache aendern → Quelle und Ziel bleiben
      gleich. Zurueck auf "Sprache" → das Paar ist wieder getrennt und das
      Level faellt auf A1 zurueck (sofern es "Kein Niveau" war). Speichern →
      die Lektion traegt die gewaehlte Domain (`domain: psychology` …); eine
      Sprachlektion traegt KEIN `domain`-Feld. Bearbeiten einer gespeicherten
      Wissenslektion oeffnet wieder mit der richtigen Domain + Inhaltssprache
- [ ] **Sprachpaar-Pruefpunkt (#1929):** Review zeigt SECHS Checklisten-
      Punkte (Titel, "Sprachpaar ist gueltig", ≥4 Karten, ≥5 Uebungen,
      ≥2 Typen, gueltige Struktur). "Sprachpaar ist gueltig" ist gruen,
      sobald Quell- UND Zielsprache unterstuetzte Codes sind — ein
      Gleiche-Sprache-Paar (de → de) ist GUELTIG (kein "Quelle != Ziel"-
      Gate)
- [ ] **Struktur-Check-Grund (#1724):** fehlgeschlagener "Gueltige
      Lektionsstruktur"-Check nennt einen konkreten Grund, nicht nur ✗
- [ ] **Template-Titel (#1674/#1756):** Template-Karten zeigen lesbare
      Titel (auch offline) + einen gedrueckten/ausgewaehlten Zustand
- [ ] **Erweiterte Uebungstypen / Extension-Wizard (#1852, #1887):** Schritt 1
      → Karte "Erweiterte Uebungstypen" startet einen eigenen 3-Schritt-Flow
      (Autoren → Review → Speichern) mit einem nicht-blockierenden Hinweis,
      dass diese Typen fortgeschritten sind. Schritt 2: "Erweiterungsuebung
      hinzufuegen" bietet sechs Typen — **Kategorisierung**, **Fehlerkorrektur**,
      **Leseverstaendnis**, **Benotetes Quiz**, **Diktat**,
      **Bildbeschreibung**. Je Typ oeffnet der
      Inline-Editor mit den passenden Feldern; Speichern ist deaktiviert bis der
      shipped Validator erfuellt ist (Kategorisierung: ≥2 benannte Buckets mit
      Items; Fehlerkorrektur: ≥2 Woerter + markierter Fehler + Korrektur;
      Leseverstaendnis: Text + ≥1 vollstaendige Frage; Benotetes Quiz: ≥1 Frage
      mit positiven Punkten; Diktat: nicht-leerer Audio-Pfad + ≥1 akzeptierte
      Transkription; Bildbeschreibung: nicht-leeres Bild + ≥1 akzeptierte
      Antwort). Leseverstaendnis + Benotetes Quiz: pro Frage Umschalten
      Multiple-Choice ⇄ Freitext, MC-Optionen mit Richtig-Haken, Benotetes Quiz
      zusaetzlich Punkte + Teilpunkte + Bestehensgrenze. Diktat (#1887): ein
      getippter `assets/audio/...`-Pfad (kein Upload in v1) + die Liste der
      akzeptierten Transkriptionen. Review zeigt die Anzahl; "Lokal speichern" →
      gespeicherte Lektion **abspielbar** (jeder Typ rendert + ist beantwortbar);
      die Set-JSON traegt `requires_extensions: ["ext:al-...@1"]`
- [ ] **Diktat im Core-Typ-Picker (#1895):** Haupt-Wizard (kartenbasiert),
      Schritt 3 "Uebung generieren" → "Uebung hinzufuegen" oeffnet den Picker
      "Uebungstyp waehlen". Neben den sechs Core-Typen (Zuordnung, Freitext,
      Lueckentext, Wort-Kacheln, Bildauswahl, Multiple Choice) erscheint als
      **siebte Option "Diktat"**. Klick → eine Diktat-Uebung wird angehaengt und
      oeffnet direkt im **gleichen** Editor wie im Extension-Wizard (Audio-Pfad +
      akzeptierte Transkriptionen), gegatet durch **denselben** Validator (leerer
      Audio-Pfad / keine Transkription → Speichern deaktiviert; unvollstaendige
      Diktat-Uebung blockiert auch "Weiter" nach Schritt 4). Nach dem Speichern:
      die gespeicherte Lektion **traegt `requires_extensions: ["ext:al-dictation@1"]`**
      (egal ob ueber den Core-Picker ODER den Extension-Wizard angelegt) und ist
      abspielbar. **Regression:** der bestehende Extension-Wizard-Weg fuer Diktat
      funktioniert unveraendert
- [ ] **Diktat-Audio-Upload (#1911, Slice 3):** Im Diktat-Editor (Core-Picker
      ODER Extension-Wizard) zeigt das Audio-Feld einen **"Audio hochladen"**-
      Button ueber einem **"…assets/audio/clip.mp3"**-Pfad-Eingabefeld. Klick auf
      Hochladen → ein Dateiauswahldialog bietet MP3/OGG/WAV. Echten Clip waehlen
      → ein eingebetteter **Audio-Player + "Entfernen"** erscheinen (das Pfad-Feld
      bleibt leer; der Base64-Blob wird nicht angezeigt), die Liste der
      akzeptierten Transkriptionen funktioniert weiter. Lektion speichern,
      abspielen: **"Listen first" spielt den hochgeladenen Clip** in der Lektion
      (beide Storage-Modi, ohne assets-Ordner — der Clip reist als Data-URI in
      der Lektion-JSON mit und ueberlebt Export/Import). **Entfernen** loescht
      ihn. **Regression:** ein getippter `assets/audio/…`-Pfad funktioniert weiter
      als Alternative (kein Upload). **Fehler:** eine zu grosse Datei (> 2 MB)
      ODER ein falsches Format (z. B. `.mp4`) zeigt eine klare Inline-Fehlermeldung
      und stuerzt nicht ab; nichts wird gespeichert
- [ ] **Bildbeschreibung-Authoring (#2095):** Im Extension-Wizard
      **Bildbeschreibung** waehlen. Der Editor zeigt einen **"Bild
      hochladen"**-Button (Label "Zu beschreibendes Bild", NICHT "(optional)"),
      einen sichtbaren Groessen-Hinweis ("komprimiert und eingebettet, max.
      ~150 KB / 512 px, externe Links nicht erlaubt") und eine Liste
      **"Akzeptierte Antworten"**. Echtes JPG/PNG/WebP hochladen → Inline-
      Vorschau + "Entfernen" erscheinen; das Bild wird als Data-URI komprimiert
      (kein assets-Ordner noetig). Speichern ist deaktiviert bis es ein Bild UND
      ≥1 akzeptierte Antwort gibt. Lektion speichern, abspielen: das **Bild wird
      gezeigt**, Beschreibung tippen, richtig / knapp daneben / falsch zeigt die
      Loesung. **Offline:** Netz ausschalten und neu laden — das eingebettete
      Bild wird WEITERHIN angezeigt (es reist in der Lektion-JSON, keine
      entfernte URL). **Fehler:** ein Bild, das nicht unter das Budget
      schrumpfbar ist, zeigt eine klare Inline-Fehlermeldung, nichts wird
      gespeichert. **iOS-Standalone (PFLICHT):** in einer installierten iOS-PWA
      eine Bildbeschreibung-Lektion mit hochgeladenem Foto anlegen, Backup
      exportieren (`.alb`), neu installieren/loeschen, importieren → Lektion
      oeffnen: Bild + akzeptierte Antworten sind intakt und das Bild wird ohne
      Netz angezeigt (beweist, dass das eingebettete Bild den iOS-IndexedDB- +
      Backup-Round-Trip ueberlebt, die bekannte Verdraengungs-Risikoflaeche)
- [ ] **Multiple-Choice Single/Multi-Umschalter (#1888):** [E2E: `mc-single-multi-toggle.spec.ts`] Im MC-Inline-Editor
      (Schritt 3, `ExerciseEditor`) steht der Modus-Umschalter
      ("Wie viele Antworten sind richtig?") als Segmented-Control **ganz oben,
      vor der ersten Options-Zeile**. Neue MC-Uebung (KI-generiert ODER manuell
      angelegt): Default ist **"Eine Antwort erlauben"**, die Options-Marker
      sind Radios (genau eine richtig). Umschalten auf **"Mehrere Antworten
      erlauben"** → Marker werden Checkboxen, zwei richtige moeglich,
      gespeicherte Uebung ist mit Mehrfachauswahl **abspielbar**. Zurueck auf
      "Eine Antwort" → auf genau eine richtige reduziert. Eine bestehende
      MC-Uebung mit gesetztem `multiple`-Wert oeffnet **unveraendert** in ihrem
      urspruenglichen Zustand.

### Karten-Bild-Upload (#1763 / #1764) [E2E: `card-image-upload.spec.ts`]

Ort: Create-Lesson Schritt 2 (Karten-Editor), im Hinzufuegen-Formular +
jeder Karten-Zeile (`CardImageField`).

- [ ] Feld "Bild (optional)" mit "Bild hochladen"-Button; nach Upload
      64x64-Vorschau + "Entfernen"
- [ ] Nur JPEG / PNG / WebP akzeptiert; anderer Typ → Inline-Fehler
      (role=alert), kein Crash
- [ ] Grosse Datei wird runterskaliert (≤512px Kante, ~150 KiB Kappe);
      undekodierbare Datei → Fehler statt Crash
- [ ] "Erweitert: Asset-Pfad verwenden" behaelt das manuelle
      `img/…png`-Feld (fuer repo-publizierte Sets)
- [ ] Round-Trip: Karte mit hochgeladenem Bild → exportieren →
      re-importieren → Bild erhalten
- [ ] Bekannte Grenze: hochgeladene data-URI-Bilder werden noch NICHT in
      einer gespielten picture_choice-Uebung gerendert (Engine `src`-Kappe)

### Lesson-Player UX (v2.3.0)
- [ ] Pause-Button liegt jetzt im Sticky-Footer (#1644), Pausieren
      funktioniert von dort
- [ ] Auto-Weiter + "Zurueck" (#1921): Einstellung "Automatisch weiter"
      (Settings -> Lernen) AN -> eine Uebung richtig beantworten, die App
      springt automatisch zur naechsten Aufgabe -> dann "Zurueck" klicken:
      die vorherige (bereits geloeste) Aufgabe bleibt stehen und springt
      NICHT sofort wieder vor; der "Weiter"-Button ist weiter klickbar
- [ ] Titelbereich schlanker, keine In-Lektion-Beschreibung mehr (#1635)
- [ ] Lektions-Zusammenfassung zeigt nur EINEN Favoriten-Button (#1649)
      [E2E: `lesson-summary-favorite.spec.ts`]
- [ ] Skip-to-Content-Link beim Tabben von oben sichtbar (#1727, a11y)
- [ ] **[MOBILE/VoiceOver, nicht blockierend] Auswahlfelder werden benannt
      angesagt (#2037):** iOS VoiceOver einschalten, `/create-lesson`
      Schritt 1 oeffnen und ueber die Auswahlfelder (Domain, Sprache(n),
      Niveau) wischen: VoiceOver sagt jeweils das SICHTBARE Label plus den
      gewaehlten Wert an (z. B. "Niveau, A1, Auswahlfeld") - NICHT nur den
      Wert und nicht "Button" ohne Namen. Gleiches im Teilen-Assistenten
      und bei den Chat-Import-Sprachwaehlern. Automatisiert abgedeckt via
      axe (`select-a11y.spec.ts`); dieser Punkt ist die Gegenprobe mit
      echtem Screenreader in der naechsten iOS-Session

### Ungueltige Lektion: freundliche Fehlermeldung (#1808 / #1824)
- [ ] Deutsche Umlaut-Karten (`währung`, `präsenz`) laden korrekt
      (App akzeptiert Unicode-Kleinbuchstaben in Karten-ids/-tags, #1808)
- [ ] Eine tatsaechlich kaputte Lektion zeigt AUSSERHALB des Entwickler-
      modus eine freundliche Meldung ("… ungueltige oder beschaedigte
      Daten … Autor kontaktieren"), NICHT den rohen Fehler-Dump (#1824)
- [ ] Mit Entwicklermodus AN (Settings): der technische Detail-Text
      erscheint wieder angehaengt

### Discover + Registry (seit v2.2.0)
- [ ] Source-Language-Filter als sichtbarer Chip auf erster Ansicht
      (nicht mehr hinter "Filter" versteckt), "Alle Sprachen" persistiert
      ueber Reload (#1699/#1701)
- [ ] Referenz-/Demo-Sets (graded-quiz-demo) erscheinen NICHT in
      Discover/Meine Inhalte (#1702/#1706)
- [ ] Per-Set Share-Link oeffnet direkt die Set-Detailseite (#1572)
- [ ] Registrierten Content-Repo hinzufuegen (register-a-repo #1511)

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

### Set-Status bleibt erhalten (aktiv/zurueckgestellt/abgeschlossen, beide Modi)

Ort: Meine Inhalte (`/content?tab=my`) → Set-Aktionen-Menue (Drei-Punkte)
eines heruntergeladenen Sets. In BEIDEN Speichermodi pruefen (Desktop/
Server = API-Modus; GitHub-Pages-PWA = Dexie-Modus), da der Bug frueher nur
im API-Modus auftrat.

- [ ] Set auf **Zurueckgestellt** setzen → in eine andere Maske wechseln
      (z. B. Dashboard) → zurueck zu Meine Inhalte → Status ist WEITERHIN
      "Zurueckgestellt" (nicht wieder "Aktiv")
- [ ] Rueckweg pruefen: einmal ueber das Menue/Navigation, einmal ueber den
      Browser-Zurueck-Button
- [ ] Alle Uebergaenge testen: aktiv → zurueckgestellt → abgeschlossen →
      wieder aktiv; jeder bleibt nach einem Maskenwechsel erhalten
- [ ] Zweite Stufe (echter Persistenz-Beweis): App komplett schliessen und
      neu oeffnen → zurueckgestellter Status ist noch da
- [ ] iPhone-PWA: gleicher Ablauf (dort urspruenglich beobachtet)

### Weitermachen-Vorschlag: keine abgeschlossenen/zurueckgestellten Sets ohne faellige Wiederholungen (#2123)

Ort: Dashboard → Uebersicht, oberster Block "Weitermachen" / "Continue
Learning". In BEIDEN Speichermodi pruefen (API + Dexie), die Logik ist
modus-unabhaengig.

- [ ] Ein Set komplett durchspielen (alle Lektionen abschliessen) ODER ueber
      das Set-Aktionen-Menue auf "Abgeschlossen" setzen, KEINE faelligen
      Wiederholungskarten → der "Weitermachen"-Block schlaegt dieses Set NICHT
      mehr vor (frueher stand es dort als "Set abgeschlossen")
- [ ] Kein offenes Set UND keine faelligen Karten → ehrlicher Leerzustand
      ("Starte deine erste Lektion", Link zu Meine Inhalte) statt irgendein
      Set als Lueckenfueller
- [ ] Abgeschlossenes Set MIT faelligen Wiederholungen → erscheint als
      Wiederholungs-Zeile ("N Elemente faellig") und fuehrt in die
      Wiederholungs-Session (`/review/{setId}`), nicht als "Set abgeschlossen"
- [ ] Zurueckgestelltes Set ohne faellige Karten → wird NICHT vorgeschlagen
- [ ] Angefangenes (aktives) Set → wird weiterhin zum Fortsetzen vorgeschlagen
- [ ] Reihenfolge: faellige Wiederholungen zuerst, dann angefangene Sets
      (jeweils zuletzt-bearbeitet zuerst)

### Update-Schutz: kein stiller Fortschrittsverlust beim Set-Update (#2128)

Ort: Meine Inhalte, ein bereits GELERNTES Set (Fortschritt + Wiederholungskarten
vorhanden), fuer das ein Update verfuegbar ist. In BEIDEN Speichermodi pruefen.
Hintergrund: ein Update, das Uebungs-/Karten-Identitaeten aendert (z. B. eine
Antwort-Korrektur), wuerde Wiederholungskarten verwaisen. Der Schutz haengt an
einem echten Alt-gegen-neu-Vergleich, nicht an einem pauschalen Abschalten.

- [ ] Vorbereitung: ein Set lernen (mind. eine Lektion, ein paar Fehler erzeugen
      -> Wiederholungskarten), fuer das eine geaenderte Fassung mit GEAENDERTER
      Antwort/Kartenfront bereitsteht.
- [ ] Manuelles Update anstossen (Button "Update" am Set): Es erscheint eine
      Bestaetigung mit bezifferter Angabe ("N Wiederholungskarten / N Lektionen
      wuerden zurueckgesetzt"), NICHT ein stilles Ueberschreiben.
- [ ] "Aktuelle Version behalten" -> nichts wird aktualisiert, Fortschritt bleibt,
      Set zeigt weiterhin "Update verfuegbar" (sichtbar + erneut entscheidbar).
- [ ] "Trotzdem aktualisieren" -> Update wird angewendet.
- [ ] Harmloses Update (nur neue Lektion/Uebung ergaenzt, keine bestehende
      Kennung geaendert) -> KEINE Nachfrage, laeuft direkt durch.
- [ ] Auto-Sync (nur bei verbundenem Nutzer-Repo, 24h): ein identitaets-aenderndes
      Update wird im Hintergrund NICHT still angewendet; das Set bleibt auf der
      bisherigen Fassung und zeigt "Update verfuegbar" (kein Hintergrund-Dialog,
      kein Datenverlust).
- [ ] iOS-Standalone (PWA): gleicher manueller Ablauf, Bestaetigung erscheint.
- [ ] Übernahme-Vorschlag (#2308): Im Bestätigungsdialog erscheint zusätzlich
      eine Liste "alt -> neu" der Wiederholungen, die übernommen werden könnten,
      plus ein Haken "Gelernten Fortschritt übernehmen" (standardmäßig gesetzt,
      WEIL die Paare darüber sichtbar sind).
- [ ] Mit gesetztem Haken bestätigen: Nach dem Update sind Fehlerzähler, Serie
      und Beherrschungs-Status an der KORRIGIERTEN Antwort vorhanden (die
      Wiederholung startet nicht bei null). Toast nennt die Anzahl.
- [ ] Haken ENTFERNEN und bestätigen: Update läuft, es wird NICHTS übernommen
      (Verhalten wie vor #2308). Der Haken ist die Entscheidung, nicht Deko.
- [ ] Nicht zuordenbare Fälle: Wurde in einer Uebung die REIHENFOLGE geändert
      oder ein Element eingefügt/entfernt, nennt der Dialog diese getrennt
      ("N lassen sich nicht sicher zuordnen und werden zurückgesetzt"). Prüfen,
      dass für diese NICHTS übernommen wurde - eine falsche Zuordnung wäre
      schlimmer als ein Verlust, weil sie unsichtbar ist.
- [ ] Auto-Sync (24h, verbundenes Nutzer-Repo): Es wird WEDER aktualisiert NOCH
      etwas übernommen. Die Zuordnung darf nur im manuellen Dialog entstehen.
- [ ] Zweimal hintereinander bestätigen (Update erneut anstossen): keine
      doppelte Übernahme, keine Fehlermeldung (idempotent).
- [ ] Sicherung vorher: Der Hinweis auf eine Sicherung ist ein Angebot, kein
      Zwang - das Update lässt sich auch ohne Sicherung bestätigen.
- [ ] iOS-Standalone (PWA): Dialog samt Paar-Liste und Haken ist vollständig
      lesbar und bedienbar (Liste läuft nicht aus dem Dialog, der Haken ist
      antippbar), Übernahme funktioniert im Dexie-Modus genauso.
- [ ] Sprache pruefen (#2160): der Bestaetigungstext erscheint in der App-Sprache
      (nicht englisch), in mehreren Sprachen stichprobenartig (de/ja/ko/el/hi).

### Wiederherstellung: Wiederholungsfortschritt nach ja/ko/zh-Korrektur (#2161)

Ort: Dashboard (Uebersicht). Hintergrund: die drei A1-Sets Japanisch, Koreanisch
und Chinesisch wurden im Juli 2026 mit einer Umschrift-Korrektur neu
veroeffentlicht, die die Antworttexte von 172 Wiederholungs-Elementen aenderte
(66 ja / 58 ko / 48 zh). Wiederholungskarten haengen am Antworttext, also fielen
bereits angelegte Karten fuer die geaenderten Elemente still aus der Planung.
In BEIDEN Speichermodi pruefen. Nur diese drei Sets sind betroffen; alle anderen
Sets bleiben unberuehrt.

- [ ] Vorbereitung: eines der Sets (ja/ko/zh A1) in der ALTEN Fassung lernen und
      ein paar Wiederholungskarten erzeugen, dann auf die korrigierte Fassung
      bringen (bzw. Testdaten mit den alten Antwort-Keys).
- [ ] Der Hinweis erscheint auf dem Dashboard NUR, wenn tatsaechlich betroffene
      Karten in den eigenen Daten liegen. Kein Hinweis, wenn nichts betroffen ist.
- [ ] Der Hinweis nennt je betroffenem Set die Anzahl betroffener Karten und
      bietet "Sicherung erstellen" an (empfohlen, nicht erzwungen).
- [ ] "Sicherung erstellen" -> es wird dieselbe .alb-Datei wie unter
      Settings → Daten erzeugt (Toast mit Dateiname).
- [ ] "Wiederholungskarten neu verknuepfen" -> beziffertes Ergebnis
      ("N neu verknuepft, N bereits korrekt"). Danach verschwindet der Hinweis
      fuer dieses Set (kein erneutes Nachfragen).
- [ ] Idempotenz: erneut ausloesen (bzw. Seite neu laden) aendert nichts mehr;
      der Hinweis kommt fuer dieses Set nicht zurueck.
- [ ] Teil-Wiederherstellung: falls ein Set nach der Korrektur erneut geaendert
      wurde, werden nicht zuordenbare Karten als Anzahl gemeldet und unveraendert
      gelassen (nicht still verworfen).
- [ ] "Set neu beginnen" -> Inline-Rueckfrage, erst nach Bestaetigung werden
      Fortschritt + Wiederholungskarten dieses Sets entfernt; danach ist der
      Hinweis fuer das Set weg.
- [ ] Kein Doppel-Mapping / keine verwaisten Zeilen: nach dem Neu-Verknuepfen
      keine Wiederholung auf einer falschen Karte, keine doppelten Karten.
- [ ] Backup-Verhalten: eine VOR der Wiederherstellung erstellte Sicherung
      importieren -> die alten (verwaisten) Keys sind wieder da, der Hinweis
      erscheint erneut und laesst sich erneut anwenden.
- [ ] iOS-Standalone (PWA): gleicher Ablauf, Hinweis + beide Aktionen
      funktionieren.
- [ ] Sprache pruefen: Hinweis- und Ergebnistexte erscheinen in der App-Sprache
      (nicht englisch), stichprobenartig in mehreren Sprachen (de/ja/ko/el/hi).

#### Zustand herstellen (Voraussetzung fuer den Test)

Der Hinweis erscheint nur, wenn betroffene Wiederholungskarten in den eigenen
Daten liegen. Der Herstell-Weg braucht Zugriff auf die Speicherinhalte
(Entwicklerwerkzeuge), und der ist im iOS-Standalone-Modus NICHT gangbar: dafuer
braucht es den Safari-Web-Inspector auf einem Mac, der QA-Rechner laeuft unter
Ubuntu. Daher die Plattformregel:

- Der erzeugte Zustand wird auf dem DESKTOP hergestellt und geprueft (App im
  Browser, Entwicklerwerkzeuge verfuegbar).
- Auf dem TELEFON (iOS-Standalone) wird NUR geprueft, wenn echte betroffene
  Daten vorliegen.

Zuerst-pruefen (zweistufig):

- [ ] Auf dem Telefon das Dashboard oeffnen. Erscheint der Hinweis von selbst,
      liegen ECHTE betroffene Daten vor -> dort testen. Dann gilt die
      Produktbedingung: VORHER "Sicherung erstellen" (Knopf im Hinweis).
- [ ] Erscheint auf dem Telefon kein Hinweis, wandert die Pruefung auf den
      DESKTOP; dort den Zustand herstellen. Ein verwaister Eintrag entsteht nicht
      mehr ueber die normale Bedienung (die korrigierte Fassung erzeugt bereits
      den neuen Key), daher braucht dieser Schritt Entwicklerwerkzeuge (so
      gekennzeichnet):

- [ ] Sicherung ziehen (Settings -> Daten -> Sicherung erstellen), damit der
      Ausgangszustand wiederherstellbar ist.
- [ ] Japanisch A1, Lektion "01-begruessungen", die Zuordnungs-Uebung
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
        elementErrors): die neue Zeile loeschen und neu anlegen; im Feld
        `element_key` und im Schluessel `id` jeweils nur das Key-Segment
        "こんにちは (konnichiwa)" durch "こんにちは" ersetzen (alle anderen
        Segmente inkl. direction unveraendert lassen).
- [ ] Dashboard neu laden -> der Hinweis erscheint (1 betroffene Karte,
      Japanisch A1).

Weg zurueck (Test wiederholbar, keine Spuren):

- [ ] Nach dem Test die in Schritt 1 gezogene Sicherung importieren
      (Settings -> Daten -> Import) -> exakter Ausgangszustand, keine Spuren.
- [ ] [Entwicklerwerkzeuge] Alternativ das UPDATE umkehren (Server) bzw. die
      Testzeile wieder auf den neuen Key setzen (Dexie).

Nicht abgedeckt: Wird der Zustand nur auf dem Desktop erzeugt und geprueft,
bleibt das Verhalten des Hinweises im iOS-Standalone-Modus UNBELEGT (die
Herstellung ist dort ohne Mac-Web-Inspector nicht moeglich). Das ist ein
zulaessiges Ergebnis, aber ausdruecklich als offen zu vermerken, nicht
stillschweigend mit dem Desktop-Ergebnis gleichzusetzen.

### Download-Sichtbarkeit (Dexie-Modus, #1709 / #1719 / #1731)
- [ ] Geloeschtes Set bleibt geloescht: Set in Meine Inhalte loeschen →
      Aktualisieren → Set kommt NICHT zurueck (#1719)
- [ ] Set aus einer nicht mehr konfigurierten Quelle bleibt in Meine
      Inhalte sichtbar (nicht still versteckt) (#1731/#1734)
- [ ] Buch-Empfehlungen kommen aus der foederierten Registry, nicht aus
      der entfernten offiziellen `books.yaml` (#1717)

### Einzelne Lektion loeschen (#2064)

Ort: Meine Inhalte (`/content?tab=my`) → Meine Lektionen → ein Set mit
MEHREREN Lektionen (z. B. nach einem Buch-Import) → "Lektionen verwalten".

- [ ] Vorbereitung: Buch importieren/erzeugen (mehrere Lektionen in einem
      Set) ODER ein mehrlektioniges eigenes Set; 1-2 Lektionen spielen
      (Fortschritt + Wiederholungskarten erzeugen)
- [ ] "Lektionen verwalten" klappt die Einzel-Lektionsliste auf; jede
      Lektion hat Abspielen + Loeschen
- [ ] Loeschen oeffnet einen Bestaetigungsdialog, der die Lektion benennt
      und sagt, dass es NICHT rueckgaengig gemacht werden kann
- [ ] Haekchen "Auch meinen Lernfortschritt loeschen" zeigt die ECHTE
      Karten-Anzahl der Lektion (nicht rueckgaengig)
- [ ] Loeschen OHNE Haekchen: Lektion verschwindet aus der Liste,
      lesson_count sinkt, Geschwister-Lektionen bleiben unveraendert;
      Fortschritt der geloeschten Lektion bleibt (verwaist, spaeter
      aufraeumbar)
- [ ] Loeschen MIT Haekchen: Fortschritt + Wiederholungskarten NUR dieser
      Lektion sind weg, Geschwister-Fortschritt bleibt
- [ ] Keine Umnummerierung: die verbleibenden Lektionen behalten ihre
      Titel/Reihenfolge, Deep-Links auf sie funktionieren weiter
- [ ] Letzte Lektion eines Sets loeschen entfernt das GANZE Set aus Meine
      Inhalte
- [ ] Dialog per Tastatur bedienbar: Loeschen-Button ist fokussiert,
      Escape/Abbrechen schliesst
- [ ] BEIDE Modi pruefen: Desktop/Server (API) UND GitHub Pages (Dexie)
- [ ] Backup-Zeitpunkt: VOR dem Loeschen ein Backup (.alb) erstellen →
      Lektion loeschen → Backup importieren → die Lektion ist wieder da
      (korrekt: ein Backup ist eine Momentaufnahme, KEIN Bug)

### Mehrere Lektionen auf einmal loeschen (#2065)

Ort: Meine Inhalte (`/content?tab=my`) → Meine Lektionen → ein Set mit
MEHREREN Lektionen → "Lektionen verwalten".

- [ ] Vorbereitung: mehrlektioniges eigenes Set (z. B. Buch-Import);
      bei 2-3 Lektionen Fortschritt + Wiederholungskarten erzeugen
- [ ] "Lektionen auswaehlen" schaltet einen Auswahlmodus ein: je Zeile
      erscheint ein Kontrollkaestchen, die Zeilenaktionen (Verschieben,
      Abspielen, Bearbeiten, Loeschen) sind in diesem Modus ausgeblendet
- [ ] "Alle auswaehlen" setzt alle Haekchen, nochmal geklickt hebt sie
      auf; "N ausgewaehlt" zaehlt korrekt mit
- [ ] "N loeschen" ist deaktiviert, solange nichts ausgewaehlt ist
- [ ] Loeschen oeffnet EINEN Bestaetigungsdialog, der die ANZAHL benennt
      und sagt, dass es NICHT rueckgaengig gemacht werden kann; der Dialog
      empfiehlt sichtbar (ohne Zwang) vorher ein Backup
- [ ] Haekchen "Auch meinen Lernfortschritt loeschen" zeigt die
      AGGREGIERTE ECHTE Karten-Anzahl ueber alle ausgewaehlten Lektionen
- [ ] Loeschen OHNE Haekchen: genau die ausgewaehlten Lektionen
      verschwinden in EINEM Schritt, lesson_count sinkt entsprechend,
      NICHT ausgewaehlte Geschwister-Lektionen bleiben unveraendert
- [ ] Reihenfolge: die verbleibenden Lektionen behalten ihre Reihenfolge
      (keine Umnummerierung), Deep-Links auf sie funktionieren weiter
- [ ] Loeschen MIT Haekchen: Fortschritt + Wiederholungskarten NUR der
      ausgewaehlten Lektionen sind weg, Geschwister-Fortschritt bleibt
- [ ] ALLE Lektionen auswaehlen und loeschen: der Dialog sagt VORHER, dass
      das GANZE Set geloescht wird; danach ist das Set aus Meine Inhalte weg
- [ ] Dialog per Tastatur bedienbar: Loeschen-Button ist fokussiert,
      Escape/Abbrechen schliesst; Kontrollkaestchen haben ein aria-label
- [ ] BEIDE Modi pruefen: Desktop/Server (API) UND GitHub Pages (Dexie)
- [ ] Backup-Zeitpunkt: VOR dem Loeschen ein Backup (.alb) erstellen →
      mehrere Lektionen loeschen → Backup importieren → die Lektionen sind
      wieder da (korrekt: ein Backup ist eine Momentaufnahme, KEIN Bug)
- [ ] iOS-Standalone (zum Homescreen hinzugefuegte PWA, Dexie-Modus):
      Auswahlmodus, Kontrollkaestchen und der Bestaetigungsdialog sind mit
      dem Finger bedienbar; die Aktionsleiste bricht auf schmalem Display
      sauber um (kein Ueberlauf)

### Content-Repo trennen vs. Fortschritt loeschen (#1651 / #1652)

Ort: Settings → Daten → Content-Repo-Liste → "Entfernen".

- [ ] Standard (Haekchen NICHT gesetzt): beruhigender Hinweis, dass der
      Lernfortschritt ERHALTEN bleibt und beim Wiederverbinden zurueck-
      kommt
- [ ] "Fortschritt loeschen"-Haekchen gesetzt: Warnung mit ECHTEN Zahlen
      (N Lektionen + M Wiederholungskarten, nicht rueckgaengig)
- [ ] Nur trennen → dasselbe Repo wieder verbinden → Fortschritt wieder da
- [ ] Trennen + loeschen → wieder verbinden → Fortschritt leer
- [ ] Haekchen erscheint nur wenn es Fortschritt zu loeschen gibt
      (Dexie-Modus)

### Social Sharing (visuell + nativ)
- [ ] Share-Button nach Lektion sichtbar
- [ ] Mobile: native Share-Sheet (WhatsApp/Telegram)
- [ ] Desktop: kopiert in Zwischenablage + Toast
- [ ] PNG Share-Card: sieht gut aus (1200x630, Theme-Tokens)

---

## PRIO 5: AI FEATURES (braucht echten API-Key)

- [ ] Provider-Tabelle: Key eingeben → "Testen" → "Verbindung ok"
- [ ] "Uebungen generieren" bei theory-only: AI liefert Ergebnis
- [ ] Qualitaet der generierten Exercises: sinnvoll? Typenvielfalt?
- [ ] "Sitzung fortsetzen" nach Chat-Import: AI kennt den Kontext
- [ ] Tutor-Chat (assistant-ui, #1126): tippen → senden (oder Enter), die
      Antwort streamt herein; die 7-Schritt-Cycle-Progress rueckt vor;
      Vorlesen + Diktat funktionieren; das Fortsetzen einer regulaeren
      Sitzung zeigt den bisherigen Gespraechsverlauf
- [ ] Importierte Sitzung: die KI beginnt von selbst mit der ersten Frage
      (kein User-Turn zuerst), der Chat startet leer
- [ ] AI Content Validation: Report sinnvoll? Provider+Modell angezeigt?
- [ ] Kein Button ohne Key fuehrt zu Error-Toast (disabled + Tooltip)

### Stapel-Generierung "Uebungen fuer alle Lektionen" (#1896)
- [ ] Meine Inhalte → Meine Lektionen, Set in dem ALLE Lektionen bereits
      Uebungen haben: Button "Uebungen fuer alle Lektionen generieren" ist
      SOFORT deaktiviert, Tooltip "Alle Lektionen haben bereits Uebungen."
      (kein Klick noetig, kein Info-Toast)
- [ ] Set mit mindestens EINER Lektion ohne Uebungen: Button aktiv,
      Kosten-Bestaetigung → Fortschritt → Ergebnis-Toast wie bisher
- [ ] Nach erfolgreichem Durchlauf (alle Lektionen fertig): Button wird
      ohne Reload deaktiviert

### KI-Schluessel-Tresor Import (#1765 / #1769)
- [ ] Settings → KI → "Konfigurierte Provider" → "Importieren" springt zu
      Settings → Daten und scrollt den KeyVault-Import-Block sichtbar (#1765)
- [ ] Import per "Datei waehlen" ODER Einfuegen des rohen Envelope-JSON in
      das Textfeld; Passphrase immer erforderlich
- [ ] Kaputtes/unvollstaendiges JSON → Inline-Fehler (aria-live), Import
      bleibt deaktiviert
- [ ] Nach erfolgreichem Import (Datei ODER Einfuegen): Wechsel zu
      Settings → KI zeigt den Key SOFORT, ohne Reload (#1769)
- [ ] Passphrase maskiert mit Reveal-Toggle; Key/Passphrase nie geloggt

---

## PRIO 6: THEMES (subjektive Aesthetik)

Fuer JEDES Theme einmal durchklicken:
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
Seit #1928 wird ein Theorie-Block in Stuecke zerlegt und als Warteschlange
gesprochen. Gemessen: 617 von 621 Theorie-Laeufen liegen ueber der
Stueckgrenze, ein mittlerer Lauf hat 1551 Zeichen.

- [ ] Auf dem iPhone eine Lektion mit langem Theorie-Text oeffnen,
      Vorlesen starten
- [ ] Der Text wird **vollstaendig** vorgelesen und bricht nicht nach
      ~15 Sekunden ab
- [ ] Beim mehrteiligen Theorie-Block schaltet die Lektion waehrend des
      Vorlesens automatisch zum naechsten Schritt weiter (die Stueckelung
      darf die Position im Text nicht verfaelschen)
- [ ] Zwischen den Stuecken entsteht kein hoerbares Stocken
- [ ] Bekanntes Plattform-Limit, KEIN Fehler: Pause/Fortsetzen wirkt auf
      iOS Safari nicht (dort stoppt + startet die App neu)

#### App-Update als installierte iOS-PWA (#1357 / #1873) - PFLICHT

Der einzige Pfad, den kein Test abdeckt: auf iOS/WKWebView aktiviert
ein neuer Service Worker sich oft NICHT durch skipWaiting + Reload,
sondern erst nach vollstaendigem Schliessen und Neuoeffnen der App.

- [ ] PWA auf dem Home-Bildschirm installieren, Build-Hash unter
      Einstellungen > Ueber notieren
- [ ] Neuen Build deployen, App aus dem Hintergrund zurueckholen
      (nicht neu starten): Update-Banner erscheint
- [ ] Banner zeigt ZUSAETZLICH den Hinweis "Schliesse die App und
      oeffne sie neu" - dieser Hinweis darf auf iOS-Standalone nie
      fehlen
- [ ] "Aktualisieren" tippen: Banner verschwindet und kommt auch nach
      Reload NICHT wieder (Accept-Unterdrueckung)
- [ ] App vollstaendig schliessen und neu oeffnen: Build-Hash unter
      Ueber ist der neue
- [ ] Auf einem NICHT-iOS-Geraet (Android/Desktop) denselben Ablauf:
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

# TEIL B: AUTOMATISIERTE TESTS (Referenz)

Diese Tests laufen in CI oder via `make test`.
Hier nur zur Dokumentation was abgedeckt ist.

---

## Automatisiert: Unit + Component Tests (Vitest, 7200+;
## aktuelle Zahl siehe docs/audits/current-coverage.md)

Abdeckung:
- Alle Exercise-Typen (Matching, Cloze, Free Text, Word Tiles, Picture Choice)
- Answer Toggle (Meine Antwort / Aufloesung) fuer alle Typen
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

Ausfuehren: `make test` oder `cd frontend && npm test`

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

Ausfuehren: `make test` (Backend-Teil)

---

## Automatisiert: Dexie-Smoke E2E (Playwright TS, 45 Spec-Dateien)

Abdeckung:
- Vollstaendiger Lesson-Playthrough (alle Exercise-Typen)
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

Ausfuehren: `make test-dexie-smoke`

---

## Automatisiert: Manual-Automation E2E (Playwright TS, 18)

Abdeckung:
- Matching Resolution Flow
- Content Hub Navigation
- Keyboard Shortcuts
- Session Flows (Mobile + Desktop)
- Critical Surfaces

Ausfuehren: `make test-manual-automation`

---

## Automatisiert: Launcher Tests (pytest, 430+)

Abdeckung:
- actions.py: Docker-Check, Status, Install, Start, Stop, Uninstall
- Port-Validierung, Free-Port-Finder
- Config Load/Save Round-Trip
- Install-Manifest CRUD
- Cleanup (find_stale, cleanup_stale)
- Health-Check Logik
- CLI-GUI Paritaet
- i18n Key Parity (DE/EN)
- Frozen-Binary Erkennung
- Cross-Platform Port-Check (Windows SO_EXCLUSIVEADDRUSE)

Ausfuehren: `cd launcher && poetry run pytest` oder `make launcher-test`

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

Ausfuehren: `make capture-screenshots` / `make verify-screenshots`

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
