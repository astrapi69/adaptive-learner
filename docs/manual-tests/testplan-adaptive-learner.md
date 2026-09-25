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

- [ ] TC-0001 App im Standalone-Modus mit realen Daten: mindestens ein importiertes
      Set, Lernfortschritt in mehreren Lektionen, ein Set auf
      "zurückgestellt" (deferred), ein Set abgeschlossen, eigene Übung
      angelegt.
- [ ] TC-0002 Backup exportieren (.alb), Datei nachweislich ausserhalb der App
      sichern (Dateien-App/AirDrop).
- [ ] TC-0003 Harter Wipe: App-Daten vollständig löschen (Safari-Websitedaten für
      die Domain entfernen, App neu installieren/öffnen - das ist die echte
      WKWebView-Eviction, nicht `localStorage.clear()`).
- [ ] TC-0004 Frischen Zustand verifizieren: App leer.
- [ ] TC-0005 Backup importieren.
- [ ] TC-0006 Prüfen: Lernfortschritt vorhanden, Deferred-Markierung vorhanden (der
      #2050-Pfad!), abgeschlossenes Set korrekt, eigene Übung vorhanden,
      Einstellungen plausibel.
- [ ] TC-0007 Danach eine Lektion normal weiterlernen - kein Folgefehler.

Ergebnis dokumentieren (auch Teilfehler einzeln). Bei JEDEM Abweichen:
Screenshot + welcher Schritt, daraus wird ein Issue mit Forensik.

#### A2. Mobile Scroll-to-Error (#2039, Visual-Device-Check vor Merge)

- [ ] TC-0008 Formular mit Validierungsfehler ausserhalb des Viewports provozieren
      (langes Formular, Fehler oben, Abschicken von unten).
- [ ] TC-0009 Erwartet: automatischer Scroll zum ersten Fehlerfeld, Fehler sichtbar
      und fokussiert.
- [ ] TC-0010 Einmal Hochformat, einmal mit eingeblendeter Tastatur.

#### A3. Rueckstands-Issues iOS

- [ ] TC-0011 Die offenen iOS-Verifikationspunkte aus dem Tracker in derselben
      Session abarbeiten (Liste aus den jeweiligen Issues, jeweils Ergebnis
      als Issue-Kommentar).

#### A3b. Einstieg für Wiederkehrer bleibt nie leer (#2573)

Robustheit beim Nachladen auf iOS - der Einstieg darf nie einen leeren
Inhaltsbereich unter intakter Kopf-/Navigationsleiste hinterlassen:

- [ ] TC-0012 Als WIEDERKEHRENDER Nutzer (Daten vorhanden) die App-URL frisch öffnen
      (z. B. einen geteilten QR-Code der App-URL scannen). Erwartet: du
      landest auf dem Dashboard - nie ein komplett leerer Inhaltsbereich
      zwischen Kopfzeile und unterer Navigationsleiste.
- [ ] TC-0013 Während eine Ansicht lädt, erscheint eine sichtbare Ladeanzeige
      (Spinner + „Lädt ..."), nie ein leerer Kasten.
- [ ] TC-0014 Fehlerfall erzwingen: Gerät offline / drosseln, sodass eine Lazy-Ansicht
      nicht laden kann, dann eine Route öffnen. Erwartet: nach kurzer
      Wartezeit eine lesbare Meldung („Das dauert länger als erwartet." bzw.
      „Diese Ansicht ließ sich nicht laden.") mit „Neu laden"-Knopf - kein
      stiller Leerbildschirm.

#### A4. Lektion löschen (#2064, gemerged) - überschneidet sich mit A1

Dieses Feature verlangt laut Testplan beide Speichermodi plus
Backup-Round-Trip inklusive iOS-Standalone. Das ist in der Substanz
derselbe Ablauf wie A1. Beides in einem Durchgang erledigen (siehe auch
den Abschnitt "Einzelne Lektion löschen (#2064)" weiter unten):

- [ ] TC-0015 In "Meine Inhalte" eine Lektion mit vorhandenem Lernfortschritt
      löschen.
- [ ] TC-0016 Bestätigungsdialog prüfen: Nennt er den Lernfortschritt (gelernte
      Karten), nicht nur die Uebungszahl?
- [ ] TC-0017 Nach dem Löschen: Lektion weg, keine verwaisten Karten in der
      Wiederholung, Favorit entfernt, Nummerierung mit Luecke wie
      entschieden.
- [ ] TC-0018 Backup von VOR dem Löschen importieren: Lektion kommt zurück (Backup
      ist ein Zeitpunkt, so entschieden). Das ist erwartetes Verhalten, kein
      Fehler.
- [ ] TC-0019 Beide Speichermodi.

#### A5. Wizard-Schritt-Reset (#2061, gemerged) - kurz, auch am Desktop möglich

- [ ] TC-0020 Buch-Set öffnen, "Lektion bearbeiten", zu Schritt 2 navigieren.
- [ ] TC-0021 Im Dropdown ein anderes Kapitel wählen: Schritt 2 bleibt, Übungen der
      neuen Lektion erscheinen.
- [ ] TC-0022 Randfälle: Wechsel zu einer Lektion ohne Übungen, Rückwärtswechsel.

#### A6. Lektionsreihenfolge verschieben (#2172, gemerged)

Die Anzeigereihenfolge ist ein eigenes Feld; Verschieben ändert die
Sortierung, nie die Identität einer Lektion. iOS-Standalone ist der heiklere
Fall (Verschieben auf dem Telefon).

- [ ] TC-0023 In "Meine Inhalte" ein mehrlektionales (Buch-)Set aufklappen ->
      "Lektionen verwalten".
- [ ] TC-0024 Je Lektion sind Auf/Ab-Bedienelemente sichtbar. Beim ersten Eintrag ist
      "Auf" deaktiviert, beim letzten "Ab" deaktiviert (kein wirkungsloses
      Klicken).
- [ ] TC-0025 Nur mit der Tastatur bedienbar: mit Tab zum Auf/Ab-Element, mit
      Leertaste/Enter auslösen. Der Screenreader liest eine verstaendliche
      Bezeichnung ("Lektion X nach oben verschieben") und nach dem Verschieben
      die neue Position ("X ist jetzt an Position n von m").
- [ ] TC-0026 Reihenfolge ist SOFORT gespeichert - keine gesonderte Speichern-Aktion.
      Seite neu laden (oder Set zu- und wieder aufklappen): die geänderte
      Reihenfolge bleibt.
- [ ] TC-0027 Wirkt auf die LERNFOLGE (#2212), nicht nur die Liste: nach dem
      Verschieben öffnet das Set mit der neuen ersten Lektion, und die
      Weiter-Navigation ("nächste Lektion") folgt der gewählten Reihenfolge -
      in beiden Speichermodi.
- [ ] TC-0028 Bestehende Sets: ohne eigenes Verschieben zeigt sich die bisherige
      Reihenfolge unverändert (kein stilles Umsortieren).
- [ ] TC-0029 Identität unberührt: nach mehreren Verschiebungen einer Lektion mit
      vorhandenem Lernfortschritt bleibt der Fortschritt zugeordnet, keine
      verwaisten Wiederholungskarten, Löschen trifft weiter die richtige
      Lektion.
- [ ] TC-0030 Backup-Round-Trip: Export -> Speicher leeren -> Import bringt die
      gewählte Reihenfolge zurück.
- [ ] TC-0031 Beide Speichermodi (API + Dexie).
- [ ] TC-0032 iOS-Standalone (PWA vom Home-Bildschirm): Verschieben per Touch und die
      Positions-Rückmeldung funktionieren, Reihenfolge bleibt nach dem
      Schliessen und Wiederoeffnen.

#### A6b. Importreihenfolge folgt der Quelle (#2173, gemerged)

Nach einem Buch-/Text-Import stehen die Lektionen in Quell-/Kapitelreihenfolge,
nicht alphabetisch nach Titel (früher: Epilog vor Kapitel 1). Die Reihenfolge
wird beim Import in denselben Overlay-Speicher wie das Verschieben (#2172)
geschrieben; Dateinamen/Identitäten bleiben unberührt. Der heikle Fall ist
die Herkunft: eine eigene Verschiebung des Nutzers darf ein erneuter Import
NICHT überschreiben.

- [ ] TC-0033 Ein Buch mit Kapiteln importieren, deren Titel alphabetisch NICHT der
      Kapitelfolge entsprechen (z. B. ein "Epilog" oder "Anhang"). Nach dem
      Import zeigt "Lektionen verwalten" die Kapitel in Buchreihenfolge, nicht
      alphabetisch.
- [ ] TC-0034 Wirkt auf die LERNFOLGE, nicht nur die Liste: das Set öffnet mit der
      ersten Quell-Lektion, die Weiter-Navigation folgt der Quellreihenfolge -
      in beiden Speichermodi (API + Dexie).
- [ ] TC-0035 Identität unberührt: Lernfortschritt/Wiederholungskarten bleiben
      zugeordnet (keine Umnummerierung der Dateinamen).
- [ ] TC-0036 Nutzer gewinnt: eine Lektion von Hand verschieben, dann dasselbe Buch
      erneut importieren (bzw. Inhalt aktualisieren). Die eigene Reihenfolge
      bleibt erhalten, wird NICHT still zurückgesetzt.
- [ ] TC-0037 Neue Lektionen bei erneutem Import nach eigenem Verschieben landen am
      Ende (sichtbar, nicht eingestreut); entfernte Lektionen verschwinden,
      die übrige gewählte Reihenfolge bleibt.
- [ ] TC-0038 Bestehende (vor #2173 importierte) Sets werden nicht automatisch
      umsortiert; der Nutzer zieht sie über "Lektionen verwalten" (#2172)
      gerade.
- [ ] TC-0039 Backup-Round-Trip: Export -> Speicher leeren -> Import bringt die
      Reihenfolge zurück.
- [ ] TC-0040 iOS-Standalone (PWA vom Home-Bildschirm): frisch importiertes Buch in der
      installierten PWA öffnen - die Kapitel stehen in Buchreihenfolge, und
      eine eigene Verschiebung überlebt ein Schliessen und Wiederoeffnen.

#### A6c. Downloadreihenfolge folgt dem Manifest (#2367)

Heruntergeladene Sets (Registry/Quellen-Browser) zeigen die Lektionen in der
im Set-Manifest deklarierten Reihenfolge (metadata.lessons), nicht mehr
alphabetisch nach Dateinamen. Der heikle Fall sind gemischte zwei- und
dreistellige Präfixe: alphabetisch sortiert 100- zwischen 10- und 11-. Gilt
an beiden Nähten: Dexie-Download (Overlay-Seed wie beim Import, #2173) und
API-Modus (Backend-Listung folgt dem Manifest).

- [ ] TC-0041 Ein Set mit gemischten Präfixen herunterladen (z. B.
      alc-psychology psych-intro, 01- bis 112-). "Lektionen verwalten" zeigt
      die Lektionen in Manifestreihenfolge: 99- vor 100-.
- [ ] TC-0042 Wirkt auf die LERNFOLGE: das Set öffnet mit der ersten Lektion laut
      Manifest, "nächste Lektion" folgt der Manifestfolge - in beiden
      Speichermodi (API + Dexie).
- [ ] TC-0043 Nutzer gewinnt: eine Lektion von Hand verschieben, dann das Set erneut
      herunterladen / aktualisieren. Die eigene Reihenfolge bleibt.
- [ ] TC-0044 Sets ohne metadata.lessons im Manifest verhalten sich unverändert
      (alphabetische Reihenfolge, kein stilles Umsortieren).

#### A6d. ZIP-Import behält das Sprachpaar (#3244)

Ein Set-ZIP, dessen Manifest `target_language`/`source_language` trägt, kam
vorher als en->en an; ein Export und erneuter Import setzte die
Ausgangssprache auf en zurück.

- [ ] TC-0896 In "Meine Inhalte" ein Set mit Ausgangssprache Deutsch (z. B. fr-a1
      aus dem Deutsch-Baum) als ZIP exportieren ("Als Datei speichern") und
      unter "Importieren" wieder importieren. Das importierte Set zeigt
      Französisch als Zielsprache und Deutsch als Ausgangssprache, und die
      Sprachausgabe der Karten spricht Französisch.
- [ ] TC-0897 Ein älteres Set-ZIP, dessen Manifest nur `language` trägt, importiert
      weiter mit dieser Zielsprache und Englisch als Ausgangssprache.
- [ ] TC-0898 Beide Speichermodi (API + Dexie).

#### A7. Bearbeiten je Lektion, nicht je Set (#2210)

Bearbeiten gehört an die Lektion, nicht an das Set. Der Set-Knopf riet
früher, welche Lektion gemeint ist, und öffnete immer die erste. Drei
gleichartige Zeilen-Knöpfe (Abspielen/Bearbeiten/Löschen) brauchen
unterscheidbare, titelbezogene Bezeichnungen. iOS-Standalone ist der heiklere
Fall (drei plus Auf/Ab je Zeile auf dem Telefon).

- [ ] TC-0045 In "Meine Inhalte" ein mehrlektionales (Buch-)Set aufklappen ->
      "Lektionen verwalten". Je Lektion sind jetzt Abspielen, Bearbeiten und
      Löschen sichtbar (zusätzlich zu Auf/Ab).
- [ ] TC-0046 Bei einem Set mit MEHREREN Lektionen gibt es KEINEN Bearbeiten-Knopf
      mehr auf Set-Ebene (er würde nur raten).
- [ ] TC-0047 Bei einem Set mit EINER Lektion bleibt der Bearbeiten-Knopf auf
      Set-Ebene (eindeutig = diese eine Lektion).
- [ ] TC-0048 Bearbeiten der ZWEITEN oder dritten Lektion öffnet genau DIESE Lektion
      im Editor (nicht die erste). Nach dem Verschieben trifft Bearbeiten
      weiterhin die richtige Lektion (Identität, nicht Position).
- [ ] TC-0049 Nur mit der Tastatur bedienbar: mit Tab zu Abspielen/Bearbeiten/Löschen,
      mit Leertaste/Enter auslösen. Der Screenreader liest je Knopf eine
      unterscheidbare Bezeichnung mit Lektionstitel ("Lektion X bearbeiten"),
      keine drei gleich klingenden Knöpfe.
- [ ] TC-0050 Beide Speichermodi (API + Dexie).
- [ ] TC-0051 iOS-Standalone (PWA vom Home-Bildschirm): alle Zeilen-Knöpfe sind mit
      dem Finger sicher und ohne Fehlgriff bedienbar; Bearbeiten öffnet die
      richtige Lektion.

### Session B: Ubuntu (Launcher-Binary, nach der Launcher-Session)

Voraussetzung: die v2.8.2-Release-Binaries (der Launcher ist seit v2.8.0 im
IMAGE-Modus, #2167; Engine-Pin docker-app-launcher ^0.25.1). Nur diese
Binaries verwenden, alle aelteren sind obsolet.

- [ ] TC-0052 Daemon läuft + Testnutzer OHNE docker-Gruppe (qatest):
      Permission-Meldung + pkexec-Fix-Angebot, NICHT "Docker starten". [seit
      dem 0.16.0-Fehlschlag ohne realen Beweis]
- [ ] TC-0053 pkexec-Fix ausführen, echte Neuanmeldung: Zustand wechselt zu "Docker
      läuft".
- [ ] TC-0054 Konsole sichtbar, Detection-Zeilen streamen, Text-Wrap korrekt, Fenster
      resizable.
- [ ] TC-0055 Branding "Adaptive Learner", About: App 2.8.2 mit Quellen-Label; die
      angezeigte Launcher-Version notieren (Ist-Wert aus dem v2.8.2-Binary).
- [ ] TC-0056 Setup läuft durch bis zum erreichbaren App-Frontend im Browser.
      Beweisziel (Image-Modus): anonymer Pull von
      ghcr.io/astrapi69/adaptive-learner:2.8.2 und Start - KEIN Build, kein
      buildx, kein Compose; Pull-Fortschritt sichtbar in der Konsole.
- [ ] TC-0057 Zweitstart bei laufendem Launcher: fokussiert das bestehende Fenster
      (#31).
- [ ] TC-0058 Stoppen, erneut starten, deinstallieren: keine Fehler, Konsole meldet
      nachvollziehbar.
- [ ] TC-0059 Portwechsel: nach den drei #2069-Faellen unter "PRIO 2 -> Portwechsel:
      Datenmitnahme" testen (der fruehere Vorbehalt ist geliefert).

### Reihenfolge-Empfehlung

Session A zuerst und in einem Durchgang: A1 und A4 teilen sich den
Backup-Round-Trip, A2 und A5 sind kurze Zusatzprüfungen. Damit fällt in
einer Sitzung das aelteste Launch-Gate zusammen mit zwei frisch gemergten
Features. Session B erst, wenn die neuen Binaries vorliegen.

---

## PRIO 1: BACKUP-AKZEPTANZTEST (Launch-Gate!)

**Neuer Testfall unter PRIO 1 Backup-Akzeptanztest:**
- [ ] TC-0060 GitHub Pages: Backup erstellen
- [ ] TC-0061 Lokal installieren (Launcher)
- [ ] TC-0062 .alb von GH Pages importieren → alles übernommen

Dieser Test ist seit Session 2 als Launch-Gate definiert.
Noch nie durchgefuehrt. JETZT machen.

- [ ] TC-0063 Daten erzeugen: mindestens 2 Sets herunterladen, 3 Lektionen starten, Theme wechseln
- [ ] TC-0064 Export: Settings → Daten → Backup erstellen → .alb Datei herunterladen
- [ ] TC-0065 Dateigrösse prüfen (sollte >1MB sein wenn Sets geladen)
- [ ] TC-0066 Browser-Daten KOMPLETT löschen:
      DevTools → Application → Storage → "Clear site data"
      UND: IndexedDB "adaptive-learner" löschen
      UND: localStorage.clear()
- [ ] TC-0067 App öffnen → Onboarding → "Backup wiederherstellen"
- [ ] TC-0068 .alb Datei auswählen → Import startet
- [ ] TC-0069 KEIN HTTP 413 Fehler (nginx 50MB Limit gefixt)
- [ ] TC-0070 Sets vorhanden (Meine Inhalte → alle zuvor geladenen Sets)
- [ ] TC-0071 Fortschritt erhalten (gestartete Lektionen, Scores)
- [ ] TC-0072 Settings korrekt (Theme, Sprache, Voice-Einstellungen)
- [ ] TC-0073 Lern-Modi Einstellungen erhalten
- [ ] TC-0074 XP + Level korrekt
- [ ] TC-0075 Legacy .json Import: altes Backup-Format → funktioniert
- [ ] TC-0076 API-Keys NICHT im Backup (Sicherheits-Check)
- [ ] TC-0077 Nach Restore: Provider-Übersicht (Settings → KI) zeigt wieder-
      hergestellte Einstellungen OHNE Reload (settings-refresh-bus, #1769)

---

## PRIO 2: LAUNCHER (Desktop)

### Grundfunktion (Ubuntu)
- [ ] TC-0078 `python3 -m adaptive_learner_launcher --debug` → EIN Fenster öffnet
- [ ] TC-0079 Fenster verschwindet NIE von selbst
- [ ] TC-0080 Docker-Check als erster Schritt (Hinweis wenn Docker nicht läuft)
- [ ] TC-0081 Live-Fortschritt bei Install im Log-Bereich (Zeile für Zeile)
- [ ] TC-0082 "Image bauen..." sichtbar (nicht stiller Hintergrund)
- [ ] TC-0083 Am Ende: "App ist bereit." in grün

### Port
- [ ] TC-0084 Port-Feld sichtbar (Default 8501)
- [ ] TC-0085 Port editierbar wenn gestoppt/nicht installiert
- [ ] TC-0086 Port read-only wenn läuft
- [ ] TC-0087 Port WECHSELN: 8501 → 9000 → App erreichbar auf 9000
- [ ] TC-0088 Port-Indikator: grün wenn läuft (nicht rot)

### Portwechsel: Datenmitnahme (#2069)
- [ ] TC-0089 Servermodus (Default): Daten anlegen, Port wechseln, neu öffnen → Sets + Fortschritt weiter da (Backend-Daten überleben; auf der Landing-Seite via identity.yaml automatisch wiederhergestellt)
- [ ] TC-0090 Browser-Speichermodus (Einstellungen > Daten > Speichermodus): Daten anlegen, Port wechseln, neu öffnen → leere App mit Hinweis "Hast du Adaptive Learner schon einmal unter einem anderen Port genutzt?" auf dem Willkommensbildschirm (Daten NICHT gelöscht, nur an den alten Origin gebunden)
- [ ] TC-0091 Der Hinweis verlinkt auf die Hilfeseite "Den Port ändern"
- [ ] TC-0092 Wiederherstellung (Browser-Modus): zurück zum alten Port → Einstellungen > Daten > Backup exportieren (`.alb`) → neuer Port → "Aus Backup wiederherstellen" → Sets, Fortschritt, Übungen, Einstellungen wieder da
- [ ] TC-0093 Kanonische Web-Version (astrapi69.github.io, Browser-Modus, kein expliziter Port): der Hinweis erscheint NICHT

### Zustaende
- [ ] TC-0094 Nicht installiert: [Installieren] sichtbar
- [ ] TC-0095 Läuft: [Im Browser öffnen] [Stoppen] [Deinstallieren]
- [ ] TC-0096 Gestoppt: [Starten] [Deinstallieren]
- [ ] TC-0097 Alle Buttons komplett sichtbar (620px breit, kein Abschneiden)

### Deinstallieren
- [ ] TC-0098 Verbose Output: jeden Container/Image einzeln mit ✓/✗
- [ ] TC-0099 Image-Groessen angezeigt
- [ ] TC-0100 Summary: "X Artefakte entfernt, Y MB freigegeben"
- [ ] TC-0101 Zustand wechselt zu "Nicht installiert"

### Cleanup beim Start
- [ ] TC-0102 Findet verwaiste Artefakte (falls vorhanden)
- [ ] TC-0103 User kann auswählen (Lerndaten default AUS)
- [ ] TC-0104 Verbose Fortschritt

### Windows
- [ ] TC-0105 .exe startet (aus GitHub Release)
- [ ] TC-0106 Persistentes Fenster (KEINE Dialog-Kette!)
- [ ] TC-0107 Alle Funktionen wie auf Linux

---

## PRIO 3: CONTENT-QUALITAET (Native-Speaker Stichprobe)

Erfordert Domaenenwissen. Nicht automatisierbar.

- [ ] TC-0108 Deutsch-Englisch A1/B1: Übersetzungen korrekt?
- [ ] TC-0109 KI-Einsteiger (DE): Fachbegriffe korrekt? Erklärungen verständlich?
- [ ] TC-0110 Ansible QE: Kommandos korrekt? Syntax stimmt?
- [ ] TC-0111 Japanisch A1: Hiragana/Katakana korrekt? Romanisierung stimmt?
- [ ] TC-0112 Koreanisch A1: Hangul korrekt? Romanisierung stimmt?
- [ ] TC-0113 Chinesisch A1: Pinyin korrekt? Zeichen stimmt?
- [ ] TC-0114 Italienisch A1: Stichprobe Grammatik/Vokabeln
- [ ] TC-0115 Portugiesisch-BR A1: Stichprobe
- [ ] TC-0116 KI-generierte Fehlerkorrektur (#2355/#2364): bei einer generierten
      `ext:al-error-correction`-Aufgabe prüfen, ob der markierte Token wirklich
      der falsche ist und die akzeptierte Korrektur ihn sinnvoll ersetzt.
      Schemakonform ist nicht gleich sinnvoll: ein bereits richtiger markierter
      Token ist gültig, aber keine echte Aufgabe, und keine Automatik kann das
      erkennen (nur diese Stichprobe). Sinngemäß gilt dasselbe fürs benotete
      Quiz und das Leseverständnis - lösbar, eindeutig, Bewertung wie erwartet

---

## PRIO 4: LERNEN - MANUELLE UX-PRUEFUNG

### Übungstypen (visuell prüfen)
- [ ] TC-0117 Matching: Paare GLEICHE Höhe (kein visueller Versatz)
- [ ] TC-0118 Matching: "Aufloesen" Animation sieht gut aus (4 Effekte testen)
- [ ] TC-0119 Matching: linke Spalte IMMER in Lektions-Reihenfolge (#2882), nur die
      rechte Spalte ist gemischt; beim "Aufloesen" behält die linke Spalte
      ihre Reihenfolge (kein Springen, #2872), rechts steht zeilenweise der
      korrekte Partner, Nummern-Badges laufen 1..n
- [ ] TC-0120 Word Tiles: Korrektur LESBAR (Leerzeichen, kein "DasGehirnvergisst...")
- [ ] TC-0121 Word Tiles: bei RICHTIGER Lösung bleibt der gebaute Satz sichtbar (#2494):
      einen Satz korrekt zusammensetzen und prüfen. Der zusammengesetzte Satz
      wird danach weiterhin (grün) angezeigt und verschwindet NICHT; darunter
      erscheinen die Erfolgsmeldung ("Richtig!") und der Weiter-Knopf. iOS PWA/
      Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm hinzugefügten
      Web-App-Icon durchführen.
- [ ] TC-0122 Free Text: Korrektur LESBAR (Token-Diff verständlich)
- [ ] TC-0123 Lückentext, Modus Auswahl (#3167): Distraktor wählen -> als falsch
      gewertet. Eine Lückentext-Übung mit Wortauswahl öffnen, deren
      Distraktoren der Lösung sehr ähnlich sind (z. B. alc-programming,
      react-grundlagen, Lektion 02 "JSX", Frage "Wie bettet man in JSX den
      Wert einer Variablen name in den Text ein?"). Die falsche Option
      `<p>Hallo $name</p>` wählen und prüfen: Ergebnis "0 von 1 richtig",
      die gewählte Option rot, die richtige Option `<p>Hallo {name}</p>`
      grün. Dann die richtige Option wählen: "Alles richtig!". Gegenprobe
      Tippen-Modus: bei einem Lückentext zum Tippen bleibt EIN Tippfehler
      weiterhin als richtig gewertet (Toleranz nur für getippte Antworten).
      Wiederholung: dieselbe Übung in der Wiederholungssitzung, falsche Option
      wählen -> falsch; die Übung gilt danach NICHT als gemeistert.
- [ ] TC-0124 Picture Choice: Kacheln GLEICHE Höhe
- [ ] TC-0125 Antwort-Reihenfolge gemischt (#2317): eine Bildauswahl (picture_choice)
      mehrfach in verschiedenen Lektionen öffnen - die richtige Kachel steht
      NICHT immer an derselben Stelle (früher durchgängig die erste). Innerhalb
      EINER Sitzung bleibt die Reihenfolge stabil (kein Springen beim erneuten
      Ansehen derselben Übung). Ein richtiger Fingertipp wird weiterhin als
      richtig, ein falscher als falsch gewertet (Bewertung + Wiederholungs-
      fortschritt inhaltsbasiert, nicht positionsbasiert). Gleiches gilt für die
      Optionen in ext:al-graded-quiz und ext:al-reading-comprehension.
      iOS PWA/Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm
      hinzugefügten Web-App-Icon durchführen.
- [ ] TC-0126 Zuordnung + Wort-Kacheln gemischt (#2371, #2372): eine Zuordnungsübung
      mehrfach öffnen (verschiedene Übungen/Besuche) - das erste Element links
      gehört NICHT durchgängig zum letzten rechts (früher praktisch immer
      umgekehrte Reihenfolge); beide Spalten erscheinen unabhängig gemischt.
      Bei Wort-Kacheln steht das erste Lösungswort NICHT durchgängig hinten in
      der Kachelleiste. Innerhalb EINER Übungsansicht bleibt die Reihenfolge
      stabil. Richtige Paare/Sätze werden weiterhin richtig gewertet (Bewertung
      inhaltsbasiert, nicht positionsbasiert). iOS PWA/Standalone: dieselbe
      Prüfung auf dem zum Home-Bildschirm hinzugefügten Web-App-Icon
      durchführen.
- [ ] TC-0127 Zuordnung: KEIN Tipp-Knopf (#2443, ersetzt #2390): eine Zuordnungsübung
      öffnen. Über den Spalten erscheint KEIN "Tipp anzeigen"-Knopf, und es wird
      dafür KEIN XP abgezogen. Grund: bei Zuordnung stehen alle Wörter beider
      Spalten vollständig auf dem Bildschirm, ein Anfangsbuchstaben-Hinweis
      verrät nichts. Bei Freitext/Cloze/Wort-Kacheln bleibt der Tipp-Knopf wie
      bisher erhalten. iOS PWA/Standalone: dieselbe Prüfung auf dem zum
      Home-Bildschirm hinzugefügten Web-App-Icon durchführen.
- [ ] TC-0128 Ein Tipp-Aufruf je Übung (#3168): eine Cloze-, eine Freitext- und eine
      Wort-Kacheln-Übung öffnen, deren Inhalt einen Autoren-Hinweis trägt (Feld
      `hint`, z. B. Französisch A1, Lektion 1: Freitext "It starts with M.",
      Wort-Kacheln "Literally 'until the re-seeing' ...", Cloze "Daytime
      greeting, starts with B."). Vor dem Prüfen gibt es GENAU EINE
      Tipp-Fläche: den Knopf "Tipp anzeigen −5 XP" über der Eingabe. Unter den
      Optionen bzw. unter der Eingabe erscheint KEIN Link "Tipp anzeigen?"
      mehr. Der erste Tipp-Klick zeigt den Autoren-Hinweis wörtlich und zieht
      XP ab (Kopfzeilen-Abzeichen blinkt rot); weitere Klicks zeigen die
      erzeugten Stufen (Länge, Anfangsbuchstabe bzw. erste Kachel), jeder
      erneut gegen XP. Ohne Autoren-Hinweis bleibt der Knopf mit den erzeugten
      Stufen wie bisher. Nach "Prüfen" ist keine Tipp-Fläche mehr sichtbar. Im
      Prüfungsmodus erscheint auch der Autoren-Hinweis nicht (kein Tipp im
      Prüfungsmodus). Dieselbe Prüfung in der Wiederholungssitzung und in der
      Audio-Kacheln-Übung (Erweiterungstyp). iOS PWA/Standalone: dieselbe
      Prüfung auf dem zum Home-Bildschirm hinzugefügten Web-App-Icon
      durchführen.
- [ ] TC-0129 Erklärung nach der Antwort (#2991): eine Übung öffnen, deren Inhalt eine
      Erklärung trägt (Feld `explanation`, z. B. das Fixture
      `e2e/fixtures/explanation-post-answer.lesson.json` über ein verbundenes
      Test-Repository). Vor dem Prüfen ist KEINE Erklärung sichtbar. Falsch
      antworten und prüfen: unter der Übung erscheint der Kasten „Erklärung"
      AUFGEKLAPPT mit gerendertem Markdown (fette „Regel", die Wort-für-Wort-
      Liste, die Beispiele). Nächste Übung richtig beantworten: der Kasten
      erscheint EINGEKLAPPT mit dem Knopf „Warum?"; ein Klick öffnet ihn,
      „Erklärung ausblenden" schließt ihn wieder. Eine Übung OHNE Erklärung
      zeigt keinen Kasten. Einstellungen > Lernen > Wiederholung >
      „Erklärungen anzeigen" ausschalten: der Kasten verschwindet sofort, auch
      in der laufenden Lektion; einschalten bringt ihn zurück. Im Prüfungsmodus
      erscheint er nie. Kein XP-Abzug. iOS PWA/Standalone: dieselbe Prüfung auf
      dem zum Home-Bildschirm hinzugefügten Web-App-Icon durchführen.
- [ ] TC-0130 Zuordnung: kein falscher Untertitel/Spaltentitel bei Wissens-Sets (#2392):
      eine Zuordnungsübung eines WISSENS-Sets öffnen (nicht-sprachliche Domäne
      oder Quell- = Zielsprache, z. B. Sinne zu Organen). Es erscheint KEIN
      Untertitel „Ordne jeden Begriff seiner Definition zu"; die Spalten tragen
      KEINE Beschriftung „Begriff"/„Definition" mehr, nur noch die Badges „A"/
      „B" und ihren Inhalt. Bei einer echten SPRACH-Übung bleibt alles wie zuvor
      (Sprachnamen bzw. Term/Übersetzung + Richtungshinweis sichtbar). iOS PWA/
      Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm hinzugefügten
      Web-App-Icon durchführen.
- [ ] TC-0131 Zuordnung: Vorspann frisst den Bildschirm nicht mehr (#2391/#2444/#2453): eine
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
- [ ] TC-0132 Zuordnung: lange Wörter brechen in der Kachel um (#3174): eine
      Zuordnungsübung mit einem Wort, das breiter als die Kachel ist, auf
      einem SCHMALEN Gerät (iPhone, 375px) öffnen, z. B. alc-psychology
      „Sprachebenen zuordnen" mit „kleinste bedeutungsunterscheidende
      Lauteinheit". Das lange Wort wird mit Trennstrich getrennt oder
      notfalls ohne Trennstrich umgebrochen und bleibt VOLLSTÄNDIG innerhalb
      des Kachelrahmens; kein Text läuft über den rechten Rand hinaus, die
      Seite scrollt nicht horizontal. Nach dem Prüfen gilt dasselbe für die
      Zeilen „Deine Antwort"/„Richtige Antwort" und für die Auflösen-Ansicht.
      Die Silbentrennung folgt der Sprache des INHALTS (Set-Sprache), nicht
      der UI-Sprache: die Kachelspalten tragen ein `lang`-Attribut mit der
      Ziel- bzw. Quellsprache (UI-Sprache umstellen ändert die Trennstellen
      nicht). Gleiches gilt für Mehrfachauswahl-Optionen, Wort-Kacheln und
      Bildauswahl-Beschriftungen. iOS PWA/Standalone: dieselbe Prüfung auf dem
      zum Home-Bildschirm hinzugefügten Web-App-Icon durchführen.
- [ ] TC-0133 Schwierigkeits-Indikator (#1693): eine Übung, deren Karte(n) eine
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

- [ ] TC-0134 Aktivieren per versteckter Geste: sechs schnelle Tipps auf die
      Fortschrittsanzeige oben in einer laufenden Lektion. Danach erscheint das
      Testmodus-Banner ("Antworten werden nicht bewertet, kein Fortschritt wird
      gespeichert").
- [ ] TC-0135 Nicht versehentlich auslösbar: einzelne oder langsame Tipps auf die
      Fortschrittsanzeige aktivieren den Modus NICHT.
- [ ] TC-0136 Jede Antwort gilt als richtig: eine bewusst FALSCHE Wahl/Eingabe (Auswahl,
      Freitext, Zuordnung) wird als richtig angezeigt, die Lektion lässt sich
      komplett durchklicken, ohne die Inhalte zu kennen.
- [ ] TC-0137 Kein Fortschritt: nach dem Durchklicken im Testmodus zeigt die Lektion
      KEINEN Fortschritt, es entstehen keine Wiederholungskarten und keine
      Fehlerzähler (Dashboard/Wiederholung prüfen).
- [ ] TC-0138 Beenden: "Testmodus beenden" im Banner schaltet zurück; das Verlassen der
      Lektion setzt den Modus zurück (erneutes Betreten startet ohne Testmodus).
- [ ] TC-0139 iOS PWA/Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm
      hinzugefügten Web-App-Icon (Geste per Fingertipp, Banner sichtbar,
      Durchklicken möglich).

### Lern-Modi (jeden einmal durchspielen)
- [ ] TC-0140 Modus-Toggle im aufklappbaren Options-Panel erreichbar (seit #1628
      hinter dem Panel, nicht mehr direkt sichtbar)
- [ ] TC-0141 Options-Panel einer EIGENEN Lektion (erstellt, importiert oder
      "Als Kopie bearbeiten"-Fork): Eintrag "Diese Lektion im Editor
      bearbeiten" sichtbar; Klick landet im Editor mit genau diesem Set
      und dieser Lektion vorgeladen (#2766)
- [ ] TC-0142 Options-Panel einer HERUNTERGELADENEN Lektion und einer
      Analyse-Lektion: KEIN Editor-Eintrag (#2766)
- [ ] TC-0143 Mentor-Notiz (eigene Lektion): unter jedem Schritt der Button
      "Mentor-Notiz"; Kategorie + Text speichern, erneutes Öffnen zeigt
      die Notiz vorausgefüllt, Entfernen löscht sie (#2768)
- [ ] TC-0144 Mentor-Notizen überleben Reload und erneutes Betreten der Lektion
      (LocalStorage-Store, in beiden Speicher-Modi identisch) (#2768)
- [ ] TC-0145 Zusammenfassung einer eigenen Lektion mit Notizen: Block
      "Mentor-Notizen (n)" mit Kategorie, Text, Entfernen je Zeile und
      dem Editor-Link; ohne Notizen und bei fremden Lektionen erscheint
      der Block nicht (#2768)
- [ ] TC-0146 Heruntergeladene/Analyse-Lektion: nirgends Mentor-Notiz-UI (#2768)
- [ ] TC-0147 Editor einer eigenen Lektion mit Mentor-Notizen: Panel
      "Mentor-Notizen zu dieser Lektion (n)" über dem Wizard; Entfernen
      einer Notiz aktualisiert Panel, Runner und Zusammenfassung (#2769)
- [ ] TC-0148 "KI-Vorschlag" je Notiz: mit hinterlegtem Schlüssel erscheint ein
      kurzer Textvorschlag; ohne Schlüssel der BYOK-Hinweis; leere
      Antwort zeigt die "nichts Brauchbares"-Meldung (#2769)
- [ ] TC-0149 "Optionen"-Button steht in DERSELBEN Zeile wie die Fortschritts-
      anzeige ("Schritt n von m"), nicht darunter (Desktop: Balken links,
      Button rechts daneben; Mobile: eng gepackt bzw. sauberer Umbruch,
      kein Ueberlappen) (#1942)
- [ ] TC-0150 Pruefungsmodus: keine Hilfen, Ergebnis am Ende, 1.5x XP
- [ ] TC-0151 Zeitmodus: Countdown-Balken sichtbar, Farb-Uebergang
- [ ] TC-0152 Fehler-Modus: nur Fehlerkarten (nach min. 1 Fehler)
- [ ] TC-0153 Rueckwaerts: Matching-Spalten getauscht
- [ ] TC-0154 Zufall: Karten aus verschiedenen Lektionen gemischt
- [ ] TC-0155 Endlos: kein Session-Ende, Statistik läuft
- [ ] TC-0156 Endlos-Abschluss ("Übung beendet"): Enter (ohne Klick) löst
      "Zurück zum Dashboard" aus (#1864, Button auto-fokussiert)
- [ ] TC-0157 Fehler-wiederholen-Abschluss ("Alle Fehler korrigiert!"): Enter
      (ohne Klick) löst "Zurück zur Lektion" aus (#1864); Klick auf den
      Button funktioniert weiterhin
- [ ] TC-0158 Lektions-Zusammenfassung ("Geschafft: ..."): mit verfuegbarer
      nächster Lektion löst Enter (ohne Klick) die primäre Karte
      "Nächste Lektion -> Starten" aus - nicht eine sekundäre Karte
      (z. B. "Wiederholung"); Klick auf die Buttons funktioniert weiterhin
      (#1943)
- [ ] TC-0159 Letzte Lektion eines Sets (keine "Nächste Lektion"): auf der
      Zusammenfassung passiert bei Enter nichts Falsches - kein Fehler,
      keine Navigation zu einer nicht vorhandenen Lektion (#1943)
- [ ] TC-0160 Fehler wiederholen bei Zuordnung (#1874): Zuordnungs-Übung mit
      gemischt richtigen/falschen Paaren spielen, "Fehler wiederholen"
      öffnen -> nur die falschen Paare erscheinen (nicht alle). Bei nur
      einem falschen Paar werden korrekte Paare als Distraktoren aufgefuellt
      (mind. 2 Paare, damit überhaupt zugeordnet werden kann)
- [ ] TC-0161 Einstellung "Fehler wiederholen" (Settings -> Lernen): Umschalten auf
      "Ganzes Set wiederholen" -> beim nächsten "Fehler wiederholen"
      erscheinen tatsächlich ALLE Paare; zurück auf "Nur Fehler zeigen"
      (Standard) -> wieder nur die falschen
- [ ] TC-0162 Regression andere Typen: Freitext/Lueckentext bei "Fehler
      wiederholen" weiterhin nur die falschen Elemente

### Spielmodus (#2844)
- [ ] TC-0163 Settings -> Lernen: Sektion "Spielmodus" mit Schalter "Spielerische
      Lektionen" vorhanden, Standard: aus
- [ ] TC-0164 Vorbereitung für alle Detail-Schritte in diesem Abschnitt (#2959):
      Einstellungen > Lernen > Spielmodus > "Details zum Spielmodus"
      aufklappen (Standard: eingeklappt); die Detail-Schalter sind nur bei
      eingeschaltetem Spielmodus bedienbar, also vorher "Spielerische
      Lektionen" einschalten
- [ ] TC-0165 Lektionsstart (erster Schritt, Spielmodus aus, Hinweis nie
      ausgeblendet): Banner "Spielmodus ausprobieren" mit "Einschalten"
      und Schließen-Knopf sichtbar
- [ ] TC-0166 "Einschalten" im Banner: Erfolgs-Toast, Banner verschwindet, der
      Schalter in den Einstellungen steht danach auf an
- [ ] TC-0167 Banner schließen ("Nicht mehr anzeigen"): Banner verschwindet und
      erscheint auch bei der nächsten Lektion nicht wieder; Spielmodus
      bleibt aus
- [ ] TC-0168 Spielmodus an: Lob-Phrase bei JEDER richtigen Antwort (nicht nur
      periodisch), Konfetti/Meilenstein-Overlays erlaubt, unabhängig von
      der eingestellten Feedback-Intensität
- [ ] TC-0169 Spielmodus an + reduzierte Bewegung im System: Feedback bleibt
      dezent (reduced motion gewinnt)
- [ ] TC-0170 Spielmodus aus: Verhalten wie bisher (Feedback-Intensität greift
      unverändert)
- [ ] TC-0171 Umschalten wirkt ohne Reload (Change-Event) und verhält sich in
      beiden Speicher-Modi identisch (localStorage)

#### Lernfunke-Maskottchen (#2849, nur bei aktivem Spielmodus)

- [ ] TC-0172 Spielmodus an, Lektion öffnen: kleine Flammen-Figur neben der
      Fortschrittsleiste sichtbar (Tooltip/Screenreader: "Dein
      Lernbegleiter"); Spielmodus aus: keine Figur, Zeile wie bisher
- [ ] TC-0173 Richtige Antwort: Figur jubelt kurz (Hüpfer, fröhliche Augen)
      und kehrt zur Ruhepose zurück
- [ ] TC-0174 Falsche Antwort: Figur muntert auf (Wackeln, überraschter Blick),
      kein Lob-Text an der Figur (das Lob unter der Aufgabe bleibt wie
      gehabt)
- [ ] TC-0175 Meilenstein während der Lektion (Level-up, Streak, Badge): Figur
      feiert (Sternaugen + Funkeln), Milestone-Overlay erscheint
      weiterhin ungestört oben mittig
- [ ] TC-0176 Lektionsabschluss: Figur wird größer, feiert und zeigt EINE
      lokalisierte Lob-Phrase als Sprechblase; Blase verschwindet von
      selbst
- [ ] TC-0177 Reduzierte Bewegung im System: Posen wechseln weiterhin (Mimik),
      aber ohne Hüpf-/Wackel-Animation
- [ ] TC-0178 Prüfungsmodus + Spielmodus: keine Reaktionen pro Antwort (kein
      Sofort-Feedback), Figur bleibt in Ruhepose bis zum Abschluss
- [ ] TC-0179 Schmaler Viewport (Mobile): Figur verdrängt die Fortschritts-
      leiste nicht; die Zeile bricht sauber um

#### Maskottchen-Varianten (#2861, Farbwelten des Lernfunke)

- [ ] TC-0180 Settings -> Lernen -> Spielmodus -> Details (aufgeklappt, siehe
      Vorbereitungsschritt #2959), Block "XP und Maskottchen": die Zeile
      "Maskottchen-Variante" mit fünf Mini-Figuren (Funke, Ozean, Wald,
      Geist, Gold) samt Hinweistext
- [ ] TC-0181 Frischer Account (Level 1, keine Abzeichen, 0 XP): nur Funke
      wählbar; Ozean "Ab Level 3", Wald "Ab Level 7", Geist "Benötigt
      das Abzeichen: Erste Sitzung", Gold mit "250 XP"-Knopf
      (deaktiviert, solange die XP nicht reichen)
- [ ] TC-0182 Mit Level 3+: Ozean anklickbar; Auswahl bleibt nach Reload
      erhalten (Markierungsring an der gewählten Variante)
- [ ] TC-0183 Bei geöffneter Lektion (Spielmodus an) die Variante wechseln:
      die Flammen-Figur neben der Fortschrittsleiste färbt sofort um,
      ohne Reload
- [ ] TC-0184 Gold-Kauf mit ausreichend XP: erster Klick zeigt "Bestätigen",
      zweiter Klick zieht 250 XP ab (XP-Anzeige oben aktualisiert
      sich), Variante ist gewählt und dauerhaft freigeschaltet
- [ ] TC-0185 Backup-Roundtrip: Export -> Wipe -> Import stellt gewählte und
      gekaufte Varianten wieder her (beide Speicher-Modi)

#### Spielmodus-Sounds (#2875)

- [ ] TC-0186 Settings -> Lernen -> Spielmodus: unter dem Modus-Schalter der
      Schalter "Spielmodus-Sounds" (Standard aus) mit Hinweistext
- [ ] TC-0187 Spielmodus einschalten, ohne die Sound-Frage je beantwortet zu
      haben: Angebot "Mit Sound spielen?" mit "Ja, Sounds an" /
      "Später"; "Ja" aktiviert die Sounds, "Später" nicht - beides
      lässt das Angebot dauerhaft verschwinden
- [ ] TC-0188 Lektionsstart-Banner (Spielmodus aus, nie ausgeblendet): neben
      "Einschalten" der Knopf "Mit Sound einschalten" - aktiviert
      Modus UND Sounds in einem Klick
- [ ] TC-0189 Sounds an, globale Töne AUS: richtige Antwort klingt (Ton steigt
      mit der Serie hörbar an), falsche Antwort dumpfer Ton,
      Checkpoint-Jingle beim Überschreiten, Fanfare beim
      Lektionsabschluss; Lautstärke folgt dem bestehenden Regler
- [ ] TC-0190 Spielmodus-Sounds AUS und globale Töne AUS: alles still;
      globale Töne AN verhalten sich wie bisher (keine
      Spielmodus-Fanfare, kein Serien-Anstieg außerhalb des
      Spielmodus)
- [ ] TC-0191 Prüfungsmodus + Spielmodus + Sounds: kein Ton pro Antwort (kein
      Sofort-Feedback); die Abschluss-Fanfare bleibt erlaubt

#### Feedback-Karte: Lautstärke immer sichtbar + Spielmodus-Hinweis (#2957)

- [ ] TC-0192 Settings -> Lernen -> Feedback: der Schalter "Töne" steht auf AUS,
      trotzdem sind der Lautstärkeregler, die Prozentanzeige und die
      "Test"-Taste sichtbar; unter dem Regler der Hinweis "Gilt auch für
      die Spielmodus-Sounds."
- [ ] TC-0193 Töne AUS, Spielmodus-Sounds AN: Regler verschieben, Lektion mit
      Spielmodus spielen - die Spielmodus-Töne folgen der neuen
      Lautstärke; Töne AUS + Spielmodus-Sounds AUS: "Test" bleibt still
- [ ] TC-0194 Spielmodus einschalten (Settings -> Lernen -> Spielmodus): unter den
      drei Intensitäts-Optionen erscheint SOFORT ohne Reload der Hinweis
      "Der Spielmodus ist an, daher ist das Feedback unabhängig von
      dieser Einstellung immer ausführlich."
- [ ] TC-0195 Spielmodus wieder ausschalten: der Hinweis verschwindet sofort; die
      gewählte Intensität bleibt unverändert markiert
- [ ] TC-0196 Spielmodus an + reduzierte Bewegung im System: beide Hinweise
      (reduzierte Bewegung + Spielmodus) sind sichtbar; das Feedback
      bleibt dezent (reduced motion gewinnt)

#### Spannungssysteme: Herzen + Countdown-Ring (#2878, opt-in, Standard aus)

- [ ] TC-0197 Einstellungen > Lernen > Spielmodus > Details (Block "Spannung",
      Vorbereitungsschritt #2959): die Schalter "Herzen (Leben)"
      und "Countdown-Ring" sind standardmäßig AUS; die Zahlenfelder
      (Herzen pro Lektion, Sekunden pro Übung) sind erst nach dem
      Einschalten des jeweiligen Schalters bedienbar und klemmen auf
      1-5 bzw. 5-120
- [ ] TC-0198 Herzen an + Spielmodus an: neben dem Serien-Chip erscheint die
      Herz-Leiste (gefüllt); jede falsche Antwort leert ein Herz mit
      kurzem Schütteln
- [ ] TC-0199 Bei 0 Herzen: freundlicher Dialog "Keine Herzen mehr!" mit
      "Nochmal versuchen" (startet die Lektion neu, Herzen voll) und
      "Lektion verlassen" (zur Übersicht); nichts Gelöstes geht verloren
- [ ] TC-0200 Korrektur-Runde in der Zusammenfassung: Fehler beheben kostet
      KEINE Herzen (die Leiste ist dort ausgeblendet)
- [ ] TC-0201 Countdown-Ring an: pro Übung läuft ein kleiner Ring (grün > gelb
      > rot, Puls in den letzten 5 Sekunden); Ablauf reißt die Serie,
      kostet ein Herz (falls an) und spielt den Fehl-Ton - die Übung
      bleibt aber offen und normal lösbar, nichts wird automatisch
      abgeschickt; nach dem Prüfen pausiert der Ring
- [ ] TC-0202 Prüfungsmodus und Auf-Zeit-Modus: weder Herzen noch Ring
      erscheinen (der Auf-Zeit-Modus behält seinen eigenen Zeitbalken)
- [ ] TC-0203 Bewertung unverändert: Punktzahl, Sterne und Fortschritt sind
      mit und ohne Spannungssysteme identisch

#### Serien-Bonus-XP (#2893, Standard an, nur im Spielmodus)

- [ ] TC-0204 Einstellungen > Lernen > Spielmodus > Details (Block "XP und
      Maskottchen", Vorbereitungsschritt #2959): der Schalter
      "Serien-Bonus-XP" ist standardmäßig AN; das Zahlenfeld
      "Bonus-XP-Obergrenze pro Lektion" ist bedienbar, klemmt auf 5-20
      (Standard 10) und wird beim Ausschalten des Schalters gesperrt
- [ ] TC-0205 Spielmodus an, Lektion mit einer Serie von mindestens 3 richtigen
      Antworten in Folge spielen: in der Zusammenfassung steht neben
      "Beste Serie: N" ein grünes "+N XP"; die angezeigten Lektions-XP
      enthalten den Bonus, und "Als erledigt markieren" schreibt exakt
      denselben Wert gut (Dashboard-XP steigen um die angezeigte Summe)
- [ ] TC-0206 Der Bonus zählt ab der DRITTEN Serienantwort (+1 pro weiterer
      richtiger Antwort in Folge); eine falsche Antwort stoppt das
      Wachstum, eine neue Serie ab 3 zählt weiter
- [ ] TC-0207 Obergrenze: mit Deckel 5 und einer langen Serie zeigt die
      Zusammenfassung höchstens "+5 XP"
- [ ] TC-0208 Schalter aus ODER Spielmodus aus: kein "+N XP" in der
      Zusammenfassung, die XP sind identisch zum normalen Modus
- [ ] TC-0209 Prüfungsmodus: kein Serien-Bonus (der Prüfungs-Multiplikator
      bleibt unverändert)

#### Arcade-Minispiele (#2887, Standard an, nur im Spielmodus)

- [ ] TC-0210 Einstellungen > Lernen > Spielmodus > Details (Block "Arcade und
      Belohnungen", Vorbereitungsschritt #2959): der Schalter "Arcade" ist
      standardmäßig AN; die Zahlenfelder "Snake-Rundenlänge" (30-120,
      Standard 60) und "Memory-Paare" (4-12, Standard 8) klemmen und
      sind bei ausgeschaltetem Schalter gesperrt
- [ ] TC-0211 Spielmodus an: auf dem Dashboard erscheint die Arcade-Karte;
      "Zur Arcade" öffnet die Spieleliste. Arcade-Schalter aus ODER
      Spielmodus aus: die Karte verschwindet komplett; ein direkter
      Aufruf von /arcade zeigt einen freundlichen Hinweis mit Link in
      die Einstellungen
- [ ] TC-0212 Lern-Memory (frei): Set-Auswahl zeigt nur heruntergeladene
      Sets und ist mit dem zuletzt gelernten Set vorbelegt (#2899),
      nicht mit dem ersten der Liste; ohne Lernfortschritt bleibt das
      erste Set vorbelegt; das Brett hat zwei Karten pro Paar (Begriff und
      Übersetzung aus echten Lektionskarten); ein Paar bleibt offen
      liegen, ein Fehlversuch zählt hoch und klappt beim nächsten
      Aufdecken zu; alle Paare gefunden zeigt die Gewinn-Meldung mit
      Versuchszahl
- [ ] TC-0213 Snake (gesperrt): auf der Spielkarte steht "Für 200 XP
      freischalten"; mit zu wenig XP ist der Knopf gesperrt (Tooltip);
      der Kauf braucht ZWEI Klicks (Bestätigungstext), zieht 200 XP ab
      (Kopfzeilen-XP sinken) und Snake wird dauerhaft spielbar (bleibt
      nach Reload freigeschaltet und reist im Backup mit)
- [ ] TC-0214 Snake spielen: Steuerung mit Pfeiltasten/WASD UND Wischgesten;
      Pause hält Uhr und Schlange an; Futter macht die Schlange
      länger (+1 Punkt); Wand oder eigener Körper beendet die Runde;
      Ablauf der Rundenzeit zeigt das Ergebnis (gewonnen ab 5
      Punkten); der lokale Bestwert erscheint als reine Anzeige
- [ ] TC-0215 Spiele vergeben KEINE XP (Kopfzeilen-XP unverändert nach einer
      gewonnenen Runde)
- [ ] TC-0216 Reduzierte Bewegung im System: keine Flip-/Blinkeffekte in
      beiden Spielen

#### Arcade: TicTacToe (#2906, 100-XP-Freischaltung)

- [ ] TC-0217 Arcade-Spieleliste: Tic-Tac-Toe erscheint zwischen Lern-Memory
      und Snake, gesperrt mit "Für 100 XP freischalten"
      (zweistufige Bestätigung wie bei Snake); ein Ticket spielt eine
      Runde ohne Kauf
- [ ] TC-0218 Runde: Klick setzt X, kurze "Die App überlegt"-Pause, dann
      setzt die App O; belegte Felder und die Denk-Pause sind
      gesperrt
- [ ] TC-0219 Die KI ist schlagbar: sie blockt nicht jede Gewinnchance -
      über mehrere Runden lässt sich gewinnen (drei in einer Reihe
      hervorgehoben, freundliche Gewinn-Meldung)
- [ ] TC-0220 Verlieren und Unentschieden enden freundlich mit
      "Neu starten"; keine XP-Vergabe durch das Spiel

#### Arcade: Simon (#2907, 300-XP-Freischaltung)

- [ ] TC-0221 Arcade-Spieleliste: Simon erscheint nach Snake, gesperrt mit
      "Für 300 XP freischalten" (zweistufige Bestätigung); ein
      Ticket spielt eine Runde ohne Kauf
- [ ] TC-0222 Runde: die App zeigt die Farbfolge Feld für Feld (Status
      "Schau dir die Folge an"), danach sind die vier Felder aktiv
      ("Du bist dran"); während der Wiedergabe sind sie gesperrt
- [ ] TC-0223 Richtige Eingabe verlängert die Folge um ein Feld und spielt
      sie erneut ab; das Runden-Label zählt "Folge {n} von {m}" hoch
- [ ] TC-0224 Falsche Eingabe endet freundlich mit der erreichten Länge und
      "Neu starten"; das Erreichen der Ziellänge gewinnt die Runde;
      keine XP-Vergabe durch das Spiel
- [ ] TC-0225 Töne: mit aktiviertem Töne- oder Spielmodus-Sounds-Schalter
      klingt jedes Feld mit eigenem Ton (Wiedergabe und Eingabe);
      ohne Opt-in bleibt das Spiel stumm und voll spielbar
- [ ] TC-0226 Einstellungen > Lernen > Spielmodus > Details (Block "Arcade und
      Belohnungen", Vorbereitungsschritt #2959): das Zahlenfeld
      "Simon-Ziellänge" klemmt auf 5-15 (Standard 8) und ist bei
      ausgeschalteter Arcade gesperrt
- [ ] TC-0227 Reduzierte Bewegung im System: Felder wechseln nur den
      Zustand (Ring/Helligkeit), kein Aufblink-/Skalier-Effekt

#### Blitzrunden (#2888, Standard an, nur im Spielmodus)

- [ ] TC-0228 Einstellungen > Lernen > Spielmodus > Details (Block "Arcade und
      Belohnungen", Vorbereitungsschritt #2959): der Schalter "Sonderrunden"
      ist standardmäßig AN; das Zahlenfeld "Blitzrunden-Karten" klemmt
      auf 5-20 (Standard 10) und ist bei ausgeschaltetem Schalter
      gesperrt
- [ ] TC-0229 Set-Übersicht (/content/set/...) bei aktivem Spielmodus: die
      Blitzrunden-Karte erscheint; solange nicht jede Lektion des Sets
      mit mindestens einem Stern abgeschlossen ist, ist der
      Start-Knopf gesperrt mit Tooltip (Freischalt-Bedingung)
- [ ] TC-0230 Set komplett (jede Lektion mit mindestens einem Stern) und
      Fehlerkarten vorhanden: der Start öffnet die Blitzrunde - Titel
      "Blitzrunde: {Set}", pro Übung läuft der Countdown-Ring (Ablauf
      reißt die Serie, nichts wird automatisch abgeschickt), die
      Übungen stammen aus den fehlerträchtigsten Karten des Sets
- [ ] TC-0231 Der Zurück-Knopf der Blitzrunde führt zur Set-Übersicht zurück
      (nicht zu einer Lektion)
- [ ] TC-0232 Perfektes Set (keine Fehlerkarten): der Start-Knopf bleibt
      gesperrt mit dem Perfekt-Tooltip
- [ ] TC-0233 Sonderrunden-Schalter aus ODER Spielmodus aus: die
      Blitzrunden-Karte verschwindet komplett
- [ ] TC-0234 Gewöhnliches "Fehler wiederholen" aus der Zusammenfassung:
      unverändert, KEIN Countdown-Ring
- [ ] TC-0235 Scoring/SRS: die Blitzrunde schreibt keine Lektions-Fortschritte;
      korrigierte Fehlerkarten verbessern wie beim Fehler-Wiederholen
      nur den SRS-Stand

#### Spiel-Tickets (#2889, Standard an, nur im Spielmodus)

- [ ] TC-0236 Einstellungen > Lernen > Spielmodus > Details (Block "Arcade und
      Belohnungen", Vorbereitungsschritt #2959): der Schalter "Spiel-Tickets"
      ist standardmäßig AN; das Zahlenfeld "Maximale Tickets" klemmt
      auf 1-10 (Standard 5) und ist bei ausgeschaltetem Schalter
      gesperrt
- [ ] TC-0237 Lektion mit voller Punktzahl abschließen: die Zusammenfassung
      zeigt das Ticket-Banner ("Belohnung freigeschaltet ...") mit dem
      Knopf "Jetzt spielen", der zur Arcade führt
- [ ] TC-0238 Arcade-Schalter aus (#3029): dieselbe Lektion mit voller Punktzahl
      zeigt in der Zusammenfassung WEDER Banner noch "Jetzt spielen",
      und es wird kein Ticket gutgeschrieben; Arcade-Schalter wieder an
      und eine weitere neue Lektion perfekt abgeschlossen: Banner und
      Knopf sind wieder da
- [ ] TC-0239 Herzen aktiv (#2878) und Durchlauf ohne Herzverlust beendet: ein
      weiteres Ticket (volle Punktzahl + alle Herzen = 2 Tickets)
- [ ] TC-0240 Streak-Meilensteine (3/7/14/30 Tage): beim Erreichen gibt es je
      ein Bonus-Ticket, jeder Meilenstein nur einmal
- [ ] TC-0241 Obergrenze: mehr Tickets als das Maximum lassen sich nicht
      ansparen; ein durch die Obergrenze blockierter Meilenstein wird
      nachgereicht, sobald wieder Platz ist
- [ ] TC-0242 Wiederbesuch der Zusammenfassung einer bereits abgeschlossenen
      Lektion: KEIN neues Ticket (kein Farmen); "Nochmal üben" mit
      neuem perfekten Durchlauf verdient regulär
- [ ] TC-0243 Korrektur-Runde und Fehler-Wiederholen vergeben keine Tickets;
      eine nachträglich korrigierte Lektion wird dadurch nicht
      "voll bepunktet"
- [ ] TC-0244 Prüfungsmodus: volle Punktzahl verdient das Ticket nach derselben
      Regel
- [ ] TC-0245 Arcade-Seite und Dashboard-Arcade-Karte zeigen den Ticket-Stand
      ("Tickets: N"); die Anzeige verschwindet bei ausgeschaltetem
      Ticket-Schalter
- [ ] TC-0246 Gesperrtes Spiel (Snake ohne XP-Kauf) mit Ticket-Guthaben: der
      Knopf "Eine Runde mit Ticket spielen" startet eine Runde und
      zieht genau ein Ticket ab; ohne Guthaben fehlt der Knopf
- [ ] TC-0247 Ticket-Schalter aus: die Arcade bietet nur den XP-Kauf bzw.
      bestehende Freischaltungen an
- [ ] TC-0248 Backup-Export > Wipe > Import: der Ticket-Stand übersteht die
      Runde (localStorage-Snapshot)

#### Bonus-Lektionen (#2890, Standard an, nur im Spielmodus)

- [ ] TC-0249 Einstellungen > Lernen > Spielmodus > Details (Block "Arcade und
      Belohnungen", Vorbereitungsschritt #2959): der Schalter
      "Bonus-Lektionen" ist standardmäßig AN
- [ ] TC-0250 Set mit einer bonus--Lektionsdatei (Dateiname beginnt mit
      "bonus-"): auf der Set-Seite erscheint die Bonus-Lektion am
      ENDE der Liste mit "Bonus"-Abzeichen, auch wenn die Datei
      alphabetisch zuerst käme
- [ ] TC-0251 Spielmodus an, Set unfertig: die Bonus-Zeile ist gesperrt
      (Schloss, kein Link); der Tooltip nennt die Bedingung (jede
      reguläre Lektion mit mindestens einem Stern)
- [ ] TC-0252 Jede reguläre Lektion mit mindestens einem Stern abgeschlossen:
      die Bonus-Zeile wird ein normaler Link und öffnet die Lektion
- [ ] TC-0253 Bonus-Schalter aus ODER Spielmodus aus: die Bonus-Lektion ist
      ein normaler Link (nur das Abzeichen bleibt) - kein Inhalt wird
      vorenthalten
- [ ] TC-0254 "Lernen starten" auf der Set-Seite öffnet die erste REGULÄRE
      Lektion, nie die Bonus-Datei
- [ ] TC-0255 Blitzrunde (#2888): eine noch gesperrte Bonus-Lektion blockiert
      die Blitzrunden-Freischaltung NICHT (nur reguläre Lektionen
      zählen)

#### Spielerische Übungs-Renderer (#2876, nur bei aktivem Spielmodus)

- [ ] TC-0256 Multiple-Choice-Übung: die Antworten erscheinen als große Kacheln
      (ab Tablet-Breite zweispaltig); die gewählte Kachel ploppt kurz
      und bekommt einen Akzentrahmen; nach dem Prüfen hüpft die richtig
      gewählte Kachel, eine falsch gewählte schüttelt sich
- [ ] TC-0257 Lückentext mit Wortauswahl: das angetippte Wort "springt" mit
      einem kleinen Hüpfer in die Lücke im Satz; ein Wechsel der Wahl
      wiederholt den Hüpfer mit dem neuen Wort
- [ ] TC-0258 Zuordnungsübung: ein frisch gebildetes Paar "schnappt" mit einem
      Pop auf beiden Kacheln zusammen; nach dem Prüfen hüpfen die
      richtigen Paare kurz; das Antippen eines Paars löst es weiterhin
- [ ] TC-0259 Verhalten unverändert: Auswahl, Prüfen, Punktzahl und Auflösung
      sind in allen drei Übungstypen identisch zum normalen Modus
- [ ] TC-0260 Spielmodus aus: klassische Listen/Chips/Kacheln ohne die
      Spiel-Optik; reduzierte Bewegung im System: die Formen bleiben,
      alle Hüpf-/Pop-Animationen entfallen

#### Juice-Paket (#2874, nur bei aktivem Spielmodus)

- [ ] TC-0261 Lektion spielen, zwei richtige Antworten in Folge: neben der
      Fortschrittsleiste erscheint der Serien-Chip (Flamme + "x2") und
      hüpft bei jeder weiteren richtigen Antwort ("x3", "x4", ...)
- [ ] TC-0262 Falsche Antwort: der Chip verschwindet (Serie gerissen); die
      nächsten zwei richtigen bauen ihn neu auf
- [ ] TC-0263 Richtige Antwort: ein "+1" steigt vom Häkchen auf und verblasst;
      das Häkchen hüpft kurz; bei falscher Antwort schüttelt das X
- [ ] TC-0264 Lektion mit mindestens 3 Schritten: zwei Checkpoint-Punkte bei
      1/3 und 2/3 auf der Fortschrittsleiste; beim Überschreiten
      leuchtet der Punkt in Akzentfarbe auf (kleiner Pop)
- [ ] TC-0265 Zusammenfassung: statt des Live-Chips steht "Beste Serie: N"
      (ab Serie 2; ohne echte Serie kein Chip)
- [ ] TC-0266 Prüfungsmodus + Spielmodus: kein Chip, kein "+1", keine
      Checkpoint-Feier pro Antwort (kein Sofort-Feedback)
- [ ] TC-0267 Spielmodus aus: nichts davon erscheint; reduzierte Bewegung im
      System: Chip/Punkte erscheinen ohne Animation, das "+1" bleibt
      unsichtbar (reine Bewegungs-Dekoration)

### Lernen-Tab: fünf Bereiche (#2956)

- [ ] TC-0268 Einstellungen > Lernen: die Karten stehen in fünf beschrifteten
      Bereichen, jeder mit einer kleinen Überschrift in Großbuchstaben
      und einer Beschreibungszeile darunter, in dieser Reihenfolge:
      "Grundlagen" (Wer lernt, und in welchen Sprachen.), "In der
      Lektion" (Wie sich Übungen beim Beantworten verhalten.), "Vorlesen
      und Diktieren" (Stimmen, Tempo, Mikrofon und Ausspracheübung.),
      "Nach der Lektion" (Wiederholungen, die Zusammenfassung und das
      Nachholen von Fehlern.), "Motivation und Routine" (Spielmodus,
      Feedback, tägliche Missionen und Erinnerungen.)
- [ ] TC-0269 Grundlagen: Lernprofil, dann Weitere Ausgangssprachen
- [ ] TC-0270 In der Lektion: Lektionsmodus, Tipps, Interaktion, dann Bevorzugte
      Übungsrichtung und Zuordnungsübung (Tipps und Interaktion stehen
      VOR Richtung und Auflösung)
- [ ] TC-0271 Vorlesen und Diktieren: nur die Karte "Sprachausgabe"; in einem
      Browser ohne Web-Speech-Unterstützung (weder Vorlesen noch
      Spracherkennung) fehlt der ganze Bereich samt Überschrift, und
      "Nach der Lektion" folgt direkt auf "In der Lektion"
- [ ] TC-0272 Nach der Lektion: Wiederholung, Zusammenfassung nach Lektionen,
      Fehler wiederholen. "Verteilte Wiederholung" ist keine eigene Karte
      mehr, sondern der letzte Block in der Karte "Wiederholung" (unter
      einer Trennlinie, mit kleinerer Überschrift): der Intervall-Plan
      (richtige Antworten in Folge gegen Tage bis zur nächsten
      Wiederholung), der Hinweis, ab wann ein Element als beherrscht
      gilt, und der Link zur Lernmethode
- [ ] TC-0273 Motivation und Routine: Spielmodus, Feedback, Tägliche Missionen,
      Erinnerungen (letzte Karte des Tabs)
- [ ] TC-0274 Handy (375 px breit): Bereichs-Überschriften und Beschreibungen
      brechen um, nichts scrollt horizontal; Tab-Wechsel und der
      Deep-Link ?tab=learning funktionieren wie zuvor

### Spielmodus: Zusammenfassungskarte + Details (#2959)

- [ ] TC-0275 Einstellungen > Lernen > Spielmodus: die Karte zeigt den Schalter
      "Spielerische Lektionen", die Spielmodus-Sounds und darunter die
      Statuszeile "N von 7 Extras an" (frischer Stand: "5 von 7")
- [ ] TC-0276 "Details zum Spielmodus" ist standardmäßig eingeklappt (Knopf mit
      Pfeil, darunter der Hinweistext "Herzen, Countdown, Arcade,
      Sonderrunden, Tickets, Bonus-Lektionen, Serien-XP und Maskottchen.");
      Aufklappen zeigt die drei Blöcke "Spannung", "Arcade und
      Belohnungen" und "XP und Maskottchen"
- [ ] TC-0277 Aufgeklappt lassen und die Seite neu laden: der Bereich bleibt
      aufgeklappt; eingeklappt lassen und neu laden: bleibt eingeklappt
      (beide Speicher-Modi, localStorage)
- [ ] TC-0278 Spielmodus AUS, Details aufgeklappt: jeder Schalter, jedes
      Zahlenfeld und die Maskottchen-Knöpfe sind ausgegraut; oben im
      Bereich steht der Hinweis "Schalte "Spielerische Lektionen" ein, um
      diese Optionen zu ändern."
- [ ] TC-0279 "Spielerische Lektionen" einschalten: der Hinweis verschwindet und
      die Detail-Schalter werden ohne Reload bedienbar; Zahlenfelder
      folgen weiterhin ihrem eigenen Schalter (z. B. "Herzen pro Lektion"
      bleibt gesperrt, solange "Herzen (Leben)" aus ist); wieder
      ausschalten sperrt alles erneut ohne Reload
- [ ] TC-0280 Einen Detail-Schalter umschalten (z. B. Herzen an): die Statuszeile
      zählt sofort mit ("6 von 7 Extras an")
- [ ] TC-0281 Arcade-Hinweisseite (/arcade bei ausgeschalteter Arcade oder
      ausgeschaltetem Spielmodus): der Link in die Einstellungen landet
      auf dem Lernen-Tab im Bereich "Motivation und Routine" (Chip aktiv,
      Bereich im Bild, siehe #2961)

### Gamification im Bereich "Motivation und Routine" (#2962)

- [ ] TC-0282 Einstellungen > Lernen > "Motivation und Routine": die Karte
      "Gamification" (XP-Benachrichtigungen, Abzeichen-Benachrichtigungen,
      "Alle Abzeichen anzeigen", Wochenend-Modus, Tägliches Sessions-Ziel,
      "Fortschritt zurücksetzen") ist die LETZTE Karte des Tabs, direkt
      hinter "Erinnerungen", optisch abgesetzt durch eine dickere
      Trennlinie mit Abstand darüber
- [ ] TC-0283 Einstellungen > Plugins: die Karte "Installierte Plugins" (#3055)
      und darunter die Karte "Lern-Repository"; keine Gamification-Karte
      mehr
- [ ] TC-0284 Bereichsleiste, Chip "Motivation und Routine": der Sprung landet
      auf der Bereichs-Überschrift, die Gamification-Karte gehört zum
      Bereich (unter derselben Überschrift)
- [ ] TC-0285 "Alle Abzeichen anzeigen" öffnet weiterhin die Abzeichen-Galerie;
      "Fortschritt zurücksetzen" fragt weiterhin zweimal nach; der
      Wochenend-Modus speichert (Reload) - in beiden Speicher-Modi
- [ ] TC-0286 Handy (375 px): die Karte und die Trennlinie brechen sauber um,
      nichts scrollt horizontal

### Daten-Tab: Bereichsleiste + Deep-Link (#3122)

Dieselbe Mechanik wie im Lernen-Tab (#2961, #2966), über den sechs
Bereichen des Daten-Tabs in der festen #1451-Reihenfolge.

- [ ] TC-0287 Einstellungen > Daten: über dem ersten Bereich steht eine Zeile mit
      Chips "Quellen", "Synchronisation", "Offline-Inhalte", "Sichern und
      Exportieren", "Aufräumen", "Gefahrenzone" (in dieser Reihenfolge,
      `settings-subnav-sources` … `settings-subnav-danger`). Ohne Auswahl
      ist kein Chip hervorgehoben; jeder Bereich trägt Überschrift und
      Beschreibung, die Karten darunter sind unverändert (Inhalte-Repos und
      Registry unter Quellen; Cache und Lektionsgröße unter Offline-Inhalte;
      Sicherung, Identität, Schlüsseltresor, Export unter Sichern;
      Aufbewahrung und verwaiste Daten unter Aufräumen; Alles löschen als
      letzte Karte, weiter abgesetzt)
- [ ] TC-0288 Chip "Sichern und Exportieren" anklicken: die Seite scrollt zum
      Bereich, die Überschrift liegt frei unter der Kopfzeile (Desktop:
      unter Kopfzeile UND Leiste), der Chip ist hervorgehoben, die Adresse
      endet auf `?tab=data&section=backup`, der Zurück-Knopf führt NICHT
      zum vorherigen Chip zurück
- [ ] TC-0289 Handy (375 px): die Chip-Zeile lässt sich seitlich wischen, kein
      horizontales Scrollen der Seite; die Sicherung ist mit einem Tipp
      erreichbar statt durch mehrere Bildschirmhöhen Scrollen
- [ ] TC-0290 Deep-Link `/settings?tab=data&section=danger` in einem neuen Tab: der
      Daten-Tab ist offen, die Gefahrenzone im Bild, der Chip hervorgehoben
- [ ] TC-0291 `/settings?tab=data&section=review` (ein Lernen-Bereich) öffnen: der
      Daten-Tab öffnet oben, kein Daten-Chip hervorgehoben, kein Fehler
- [ ] TC-0292 Sprung aus KI-Tab "Schlüssel exportieren" / "importieren" (#1183,
      #1765): landet weiterhin auf dem Schlüsseltresor im Bereich "Sichern
      und Exportieren"; die Leiste stört den Sprung nicht
- [ ] TC-0293 Ohne Auswahl langsam scrollen: der hervorgehobene Chip folgt dem
      Bereich, dessen Überschrift oben im Bild steht; die Adresse ändert
      sich dabei NICHT
- [ ] TC-0294 Beide Speichermodi (API + Dexie): Leiste und Deep-Link gleich; im
      Dexie-Modus zeigt der Bereich "Synchronisation" den Desktop-Hinweis

### Lernen-Tab: Bereichsleiste + Deep-Link (#2961)

- [ ] TC-0295 Einstellungen > Lernen: über dem ersten Bereich steht eine Zeile
      mit Chips "Grundlagen", "In der Lektion", "Vorlesen und Diktieren",
      "Nach der Lektion", "Motivation und Routine" (in dieser Reihenfolge;
      ohne Web-Speech-Unterstützung fehlt der Chip "Vorlesen und
      Diktieren"). Ohne Auswahl ist kein Chip hervorgehoben
- [ ] TC-0296 Chip "Nach der Lektion" anklicken: die Seite scrollt zum Bereich
      "Nach der Lektion", die Bereichs-Überschrift liegt frei unter der
      Kopfzeile (Desktop: unter Kopfzeile UND Leiste), der Chip ist
      hervorgehoben, die Adresse endet auf `?tab=learning&section=review`
      und der Browser-Zurück-Knopf führt NICHT zum vorherigen Chip zurück
      (kein neuer Verlaufseintrag)
- [ ] TC-0297 Desktop (>= 768 px): weiter nach unten scrollen - die Leiste bleibt
      direkt unter der App-Kopfzeile sichtbar und überdeckt keinen Text.
      Handy (375 px): die Leiste scrollt mit der Seite weg, die Chip-Zeile
      lässt sich seitlich wischen, nichts scrollt horizontal auf
      Seitenebene
- [ ] TC-0298 Deep-Link `/settings?tab=learning&section=motivation` in einem neuen
      Tab öffnen: der Lernen-Tab ist offen, der Bereich "Motivation und
      Routine" im Bild, der Chip hervorgehoben; am Handy ist der aktive
      Chip in der Zeile sichtbar (die Zeile wurde dorthin gescrollt)
- [ ] TC-0299 `/settings?tab=learning&section=unsinn` öffnen: der Tab öffnet oben,
      kein Chip hervorgehoben, kein Fehler
- [ ] TC-0300 Mit aktivem Bereich in einen anderen Tab wechseln (z. B. Daten): die
      Adresse trägt nur noch `?tab=data`; zurück auf Lernen: kein Chip
      hervorgehoben, keine Scrollbewegung
- [ ] TC-0301 Systemeinstellung "Bewegung reduzieren" aktiv: der Sprung erfolgt
      ohne Animation (sofort), sonst weich
- [ ] TC-0302 Ohne Auswahl langsam durch den Tab scrollen (#2966): der
      hervorgehobene Chip folgt dem Bereich, dessen Überschrift gerade
      oben im Bild steht (Grundlagen -> In der Lektion -> ... ->
      Motivation und Routine); nach einem Chip-Klick bleibt der geklickte
      Chip hervorgehoben, bis der Bereich im Bild ist, und folgt danach
      wieder dem Scrollen. Die Adresse ändert sich beim Scrollen NICHT
- [ ] TC-0303 Überschriften-Hierarchie (#2966, Screenreader / Browser-Outline):
      im Lernen-Tab sind die Bereichs-Überschriften h2 und die
      Karten-Titel darin h3; auf den anderen Tabs bleiben die Karten-Titel
      h2
- [ ] TC-0304 Beide Speicher-Modi (API + Dexie): Leiste und Deep-Link verhalten
      sich identisch

### Zusammenfassung zählt Korrekturen mit (#2479)
- [ ] TC-0305 Eine Lektion mit mehreren falschen Antworten spielen, dann in der
      Korrektur-Runde am Ende die Fehler beheben. Der Punktzahl-Balken zeigt
      zwei Abschnitte: was auf Anhieb saß (voll gefüllt) und was nach Korrektur
      dazukam (schraffiert), mit Legende "N auf Anhieb" / "N nach Korrektur".
- [ ] TC-0306 Sterne, Botschaft und die "+N XP" richten sich nach dem Endstand: wer alle
      Fehler behebt, bekommt volle Sterne und "Volle Punktzahl!", nicht mehr
      "1 von 3 Sternen" / "Guter Anfang". Die gutgeschriebene XP entspricht der
      angezeigten Zahl.
- [ ] TC-0307 Ohne Korrektur-Runde bleibt der Balken einfarbig (kein leerer zweiter
      Abschnitt, keine Legende), Sterne + Botschaft wie gehabt.
- [ ] TC-0308 Prüfungsmodus (Exam): Der Endstand richtet sich NICHT nach der Korrektur
      - ein Prüfungsergebnis ist der erste Durchgang (Balken einfarbig, Sterne
      + XP unverändert).
- [ ] TC-0309 Barrierefreiheit: Die beiden Balkenabschnitte sind auch ohne Farbe
      unterscheidbar (Schraffur + Legende) - in hellem UND dunklem Design
      prüfen.
- [ ] TC-0310 iOS PWA/Standalone: dieselbe Prüfung auf dem zum Home-Bildschirm
      hinzugefügten Symbol (der Befund kam von dort). Balken, Sterne, Botschaft
      und XP zeigen den Endstand nach der Korrektur.

### "Warum du diese verpasst hast" zeigt die Frage (#2757)
- [ ] TC-0311 Eine Lektion mit mindestens einem falsch beantworteten Element spielen
      (Erklärungen in Einstellungen > Lernen aktiv). Im Bereich "Warum du
      diese verpasst hast" steht über jedem Antwort-Vergleich die Zeile
      "Frage:" mit dem, was gefragt war (Aufgabentext, bei Lückentext der
      Satz mit "___", bei Zuordnen der abgefragte Begriff) - nicht nur
      "Deine Antwort" / "Richtig".
- [ ] TC-0312 Zuordnen-Übung mit einem falschen Paar: Als Frage erscheint der
      abgefragte Begriff (linke Seite des Paars), niemals eine interne ID.
- [ ] TC-0313 Kann die Frage nicht ermittelt werden (z. B. Inhalt inzwischen
      aktualisiert), erscheint der Eintrag wie bisher ohne Frage-Zeile -
      kein Fehler, keine leere Zeile.

### Ein Fehler-Bereich, zugeklappt (#2496)
- [ ] TC-0314 Eine Lektion mit mindestens einem Fehler spielen. Auf der
      Zusammenfassung erscheint der Bereich "Fehler ausbessern (N)"
      ZUGEKLAPPT: KEIN Textfeld hat den Fokus, es poppt KEINE Tastatur auf
      (auf dem Handy prüfen - das war der Befund). Die Punktzahl bleibt sichtbar.
- [ ] TC-0315 Auf "Jetzt ausbessern" tippen -> der Bereich klappt auf, die erste
      Korrektur-Übung (Lückentext) erscheint und bekommt JETZT den Fokus
      (Tastatur darf jetzt aufgehen - bewusste Aktion des Nutzers).
- [ ] TC-0316 Innerhalb des aufgeklappten Bereichs gibt es die sekundäre Aktion
      "Alle Übungen erneut (N)" -> führt auf die Fehler-wiederholen-Seite
      mit den echten fehlgeschlagenen Übungen.
- [ ] TC-0317 In den "Nächste Schritte"-Karten gibt es KEINE eigene
      "Fehler wiederholen"-Karte mehr (in den einen Bereich zusammengeführt).
      Enter aktiviert weiterhin die primäre Vorwärts-Karte (Nächste Lektion /
      Adaptiv / Wiederholung), nie den zugeklappten Fehler-Bereich.
- [ ] TC-0318 Sind bereits alle Fehler korrigiert, zeigt der Bereich eine kurze
      Erfolgsmeldung ("Alle Fehler korrigiert!") statt einer Übung.
- [ ] TC-0319 #2570: Nur nicht-lückentext-fähige Fehler (kein Cloze generierbar) - der
      Bereich zeigt DIREKT "Wiederhole deine Fehler" mit dem Hinweis "Das lässt
      sich nicht als Schnellübung anzeigen - wiederhole stattdessen die
      Übungen." + dem Button "Alle Übungen erneut (N)". KEIN "Jetzt
      ausbessern"-Zwischenschritt mehr, der nur ins Leere aufklappen würde.
- [ ] TC-0320 #2570 Platzierung: der Fehler-Bereich steht in der Standard-Reihenfolge
      VOR den "Nächste Schritte"-Karten (Nächste Lektion / Adaptiv / ...), nicht
      danach - erst die eigenen Fehler ausbessern, dann entscheiden wie es
      weitergeht. Bleibt über Settings weiterhin frei umsortierbar.

### Korrekturrunde: Ergebnis bleibt stehen, dann Weiter (#3125)
- [ ] TC-0321 Lektion mit mindestens zwei Fehlern beenden, "Jetzt ausbessern"
      drücken, die erste Lücke RICHTIG füllen und prüfen: die Lücke wird
      grün, "Alles richtig!" erscheint, darunter der grüne Erfolgsbalken
      mit "Weiter". Die Runde springt NICHT von selbst weiter (Auto-Weiter
      in Einstellungen > Lernen aus)
- [ ] TC-0322 "Weiter" drücken (oder Enter): jetzt kommt die nächste Übung
      (Zähler "2 / N")
- [ ] TC-0323 Eine Lücke FALSCH füllen und prüfen: die Lücke wird rot, "0 von 1
      richtig", Meine Antwort / Lösung bleiben sichtbar, darunter ein
      schlichter "Weiter"-Knopf; kein Auto-Weiter, auch nicht mit
      eingeschaltetem Auto-Weiter
- [ ] TC-0324 Einstellungen > Lernen > Auto-Weiter einschalten, Runde erneut:
      nach einer RICHTIGEN Antwort bleibt der Erfolgsbalken kurz stehen
      (wie in der Lektion) und die Runde geht von allein weiter
- [ ] TC-0325 Nach der letzten Übung führt "Weiter" zur Abschlussmeldung
      ("Korrekturrunde abgeschlossen", N Elemente verbessert); die Zahl
      stimmt mit den richtigen Antworten überein
- [ ] TC-0326 Überspringen bleibt jederzeit möglich; die Gegenüberstellung mit dem
      vorigen Durchgang (#983) ist unverändert

### Neue Übungstypen (seit v2.2.0, visuell + funktional)
- [ ] TC-0327 multiple_choice: Auswahl, Feedback, SRS-Attempt
- [ ] TC-0328 matching Auflösen-Umschalter (#3140): nach einer nicht komplett
      richtigen Prüfung steht der Umschalter "Meine Antworten" / "Auflösen";
      bei komplett richtiger Antwort erscheint KEIN Umschalter - in der
      Lektion nur "Weiter", in der Wiederholungs-Sitzung, Endlos-, Shuffle-,
      adaptiven und Fehler-Wiederholungs-Lektion nur die bewerteten Spalten
- [ ] TC-0329 matching Korrektur-Ansicht (#3186): nach einer nicht komplett
      richtigen Prüfung stehen drei Knöpfe "Meine Antworten" / "Korrektur" /
      "Auflösen". "Meine Antworten" ist aktiv und zeigt die Paare genau so,
      wie du sie gebildet hast (nummerierte, farbige Paar-Markierungen),
      OHNE Bewertung: kein Grün/Rot, auch keine grüne Paarfarbe (#3261),
      keine Zeile "Deine Antwort" oder "Richtige Antwort" (#3233). "Korrektur" zeigt das bewertete Raster
      (grün/rot, "Deine Antwort") plus unter jedem Fehler die richtige
      Antwort, "Auflösen" die Lösung. "Nochmal versuchen" und erneutes Prüfen startet
      wieder in "Meine Antworten"
- [ ] TC-0330 matching Korrektur-Einstellung (#3186): Einstellungen > Lernen >
      Karte "Zuordnungsübung" > "Korrektur als eigene Ansicht" ist
      standardmäßig an. Aus: nur zwei Knöpfe "Meine Antworten" / "Auflösen",
      die richtige Antwort steht direkt unter jedem Fehler. Umschalten wirkt
      sofort auf eine offene Übung. Im Prüfungsmodus (kein Umschalter) steht
      die richtige Antwort immer direkt unter dem Fehler
- [ ] TC-0331 ext:al-categorization: Kategorien zuordnen, Auflösung lesbar; nach
      "Antwort prüfen" bleiben die Verdikt-Chips samt roter Korrektur-Kategorie
      INNERHALB ihrer Spalte (kein Überlaufen in die Nachbarspalte, #2771) -
      die Korrektur steht auf einer eigenen Zeile unter dem Element
- [ ] TC-0332 ext:al-categorization Auflösen-Umschalter (#2772): nach einer nicht
      komplett richtigen Prüfung erscheint neben der Ergebniszeile der
      Umschalter "Meine Antworten" / "Auflösen" (wie bei den Paaren).
      "Auflösen" zeigt jede Kategorie mit ihren richtigen Elementen; selbst
      richtig zugeordnete Elemente sind grün getönt mit Häkchen. "Meine
      Antworten" kehrt zur bewerteten Ansicht zurück, "Nochmal versuchen"
      setzt auf die interaktive Ansicht zurück. Bei komplett richtiger
      Antwort erscheint KEIN Umschalter (nur "Weiter")
- [ ] TC-0333 ext:al-error-correction: Fehler finden + korrigieren
- [ ] TC-0334 ext:al-error-correction Auflösung (#2803): nach einer falschen
      Prüfung erscheint neben der Ergebniszeile der Umschalter "Meine
      Antwort" / "Auflösung" (wie bei Paaren/Kategorien). "Auflösung"
      zeigt den Satz als Wortkacheln: das falsche Wort rot
      durchgestrichen mit X, direkt daneben die richtige Korrektur grün
      mit Häkchen - man sieht, WO im Satz der Fehler lag. "Meine
      Antwort" kehrt zur bewerteten Ansicht (inkl. Lösungszeile)
      zurück; "Nochmal versuchen" setzt auf die interaktive Ansicht
      zurück. Bei richtiger Antwort erscheint KEIN Umschalter
- [ ] TC-0335 ext:al-reading-comprehension: Text + Fragen
- [ ] TC-0336 ext:al-reading-comprehension Auflösung (#2633): nach "Antworten prüfen"
      wird die richtige Multiple-Choice-Option GRÜN hervorgehoben - mit Häkchen
      und Text-Badge, nicht durch Farbe allein. Hat man sie selbst gewählt,
      steht dort "Richtig"; hat man daneben gegriffen, trägt die richtige
      Option "Richtige Antwort" (grün, gestrichelter Rahmen) und die eigene
      Wahl "Falsch" (rot). Bei Freitext-Fragen erscheint die Lösungszeile grün
      getönt mit Häkchen statt als grauer Fließtext. Gleiche Farbsprache wie
      bei den Paaren (Matching). In allen 12 Themes prüfen: der Text bleibt
      auf der Tönung lesbar.
- [ ] TC-0337 ext:al-graded-quiz: Bewertung + Ergebnisanzeige
- [ ] TC-0338 ext:al-dictation (#1881): "Listen first" spielt den Clip, Transkription
      tippen; richtig / knapp daneben ("Almost!") / falsch zeigt die Lösung;
      eine Lektion mit `requires_extensions: ["ext:al-dictation@1"]` laedt
      (wird nicht vom Guard abgelehnt)
- [ ] TC-0339 ext:al-image-description (#2095): das Bild wird gezeigt, eine
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
- [ ] TC-0340 ext:al-speak-and-record (engine#68 Idee 3): der Satz wird per TTS
      vorgelesen (ohne autorisiertes `audio` fällt es auf die
      Sprachsynthese zurück, mit `audio` spielt der authentische Clip ab);
      "Text anzeigen" deckt den Satz erst nach Klick auf; "Aufnahme"
      fordert das Mikrofon an - ECHTE Aufnahme auf einem Gerät mit
      Mikrofon testen, die automatisierte Suite kann MediaRecorder nur
      mocken. Nach der Aufnahme: Wiedergabe-Player erscheint, "Fertig" wird
      klickbar. Erneut aufnehmen überschreibt den vorherigen Clip (keine
      Historie). Schritt erneut besuchen -> der zuletzt gespeicherte Clip
      spielt automatisch nach; eine Lektion mit
      `requires_extensions: ["ext:al-speak-and-record@1"]` lädt (nicht vom
      Guard abgelehnt). Bewusst UNGEWERTET: kein "richtig/falsch", keine
      SRS-Zeile nach Abschluss (im Gegensatz zu jedem anderen Aufgabentyp).
      Mikrofon-Zugriff verweigert -> freundliche Fehlermeldung, kein
      Absturz. Kein Mikrofon vorhanden -> Aufnahme-Button entsprechend
      deaktiviert/verborgen, kein Absturz.
- [ ] TC-0341 **Speicherdeckel + Verdrängung (#2841):** Aufnahmen werden ab einem
      Gesamtvolumen automatisch verdrängt (älteste zuerst) - im normalen
      Gebrauch praktisch nicht erreichbar (~170 max-lange Aufnahmen nötig),
      daher hier nur der Regressionscheck: normaler Aufnahme-Ablauf
      (aufnehmen -> Wiedergabe -> erneut aufnehmen) funktioniert weiterhin
      unverändert. Die Verdrängungslogik selbst ist durch automatisierte
      Tests abgedeckt (`speech-recordings-dexie.test.ts`), nicht manuell
      geprüft. Falls doch einmal die Meldung "Deine vorherige Aufnahme
      wurde entfernt…" erscheint: kein Absturz, "Erneut aufnehmen"
      funktioniert normal und die Meldung verschwindet danach.
- [ ] TC-0342 Listen-First-Audio (#1687): Audio-Button auf free_text +
      matching spielt ab, Grading unbeeinflusst
- [ ] TC-0343 Parametrische Aufgaben (#3109, Schema v1.14): eine free_text-Aufgabe
      mit `variables` zeigt KONKRETE Zahlen im Prompt (keine `{{name}}`-
      Klammern sichtbar), bei jedem frischen Durchgang derselben Lektion
      eine andere Ziehung; die exakte berechnete Antwort wird akzeptiert,
      und eine Zahl NAHE der Antwort (innerhalb der autorisierten Toleranz)
      wird EBENFALLS akzeptiert, auch wenn der Text abweicht (z. B. "10,3"
      wird für eine berechnete "10" mit Toleranz 0,5 akzeptiert) - eine
      klar falsche Zahl wird abgelehnt. Ein bereits abgeschlossener Schritt
      zeigt beim erneuten Besuch dieselben Zahlen wie beim ersten Mal, keine
      neue Ziehung. Eine Lektion OHNE `variables` (z. B. Inhalt, der
      Jinja2-Templating lehrt) lässt jedes wörtliche `{{ ... }}` im Text
      unangetastet.
- [ ] TC-0344 ext:al-ordering (#3110): Schritte als durcheinandergewürfelte,
      ziehbare Kacheln; auf eine durcheinandergewürfelte Kachel tippen
      platziert sie, auf eine platzierte Kachel tippen gibt sie zurück,
      Ziehen (oder die ◀ ▶ Pfeile / Pfeiltasten) sortiert um. "Prüfen"
      akzeptiert NUR die exakt autorisierte Reihenfolge - eine Vertauschung
      ist falsch. "Nochmal versuchen" setzt die Platzierung zurück; eine
      Lektion mit `requires_extensions: ["ext:al-ordering@1"]` lädt (wird
      nicht vom Guard abgelehnt).
- [ ] TC-0345 ext:al-ordering Auswertung (#3260): nach "Prüfen" erscheint unter
      "Deine Antwort" die eingereichte Reihenfolge, nummeriert, jeder Schritt
      mit grünem Haken oder rotem X. Bei falscher Antwort folgt darunter die
      "Lösung" mit der richtigen Reihenfolge; bei richtiger Antwort keine
      Lösung. Die Fehlermeldung lautet "Nicht ganz - die Reihenfolge stimmt
      noch nicht." (keine Aufforderung zum Wiederholen). Im Prüfungsmodus
      erscheint keine Aufschlüsselung. Auch auf dem Handy (schmale Breite)
      bleiben lange Schritte lesbar umgebrochen.
- [ ] TC-0346 ext:al-parsons (#3110): Code-Zeilen als durcheinandergewürfelte,
      ziehbare Kacheln (Monospace), dieselbe Tipp-/Zieh-Umsortierung wie bei
      ordering, PLUS ein Einrück-Stepper pro Kachel (- / Tiefe / +).
      "Prüfen" verlangt SOWOHL die richtige Reihenfolge ALS AUCH die
      richtige Einrückung pro Zeile - eine richtige Reihenfolge in falscher
      Tiefe ist falsch. Die Einrückung bleibt an der Kachel, wenn sie
      woanders hingezogen wird. "Nochmal versuchen" setzt Platzierung UND
      jede Einrückung auf 0 zurück; eine Lektion mit
      `requires_extensions: ["ext:al-parsons@1"]` lädt (nicht vom Guard
      abgelehnt).
- [ ] TC-0347 ext:al-parsons Auswertung (#3218): nach "Prüfen" erscheint unter
      "Deine Antwort" der eingereichte Code in der gewählten Einrückung, jede
      Zeile mit grünem Haken oder rotem X; falsche Zeilen nennen den Grund
      ("Falsche Position" bzw. "Einrückung 0, erwartet 2"). Bei falscher
      Antwort folgt darunter die "Lösung" mit richtiger Reihenfolge und
      Einrückung; bei richtiger Antwort keine Lösung. Im Prüfungsmodus
      erscheint keine Aufschlüsselung.
- [ ] TC-0348 ext:al-reading-comprehension Lesetext (#3217): ein Lesetext mit
      Codeblock (```-Zaun) zeigt den Code mehrzeilig, eingerückt, in
      Monospace und bei langen Zeilen horizontal scrollbar; Absätze und
      einfache Zeilenumbrüche im Lesetext bleiben erhalten.
- [ ] TC-0349 ext:al-hotspot (#3110): ein Bild mit unsichtbaren klickbaren Zonen -
      die richtige Stelle anklicken. Vor "Prüfen" ist kein Umriss und keine
      Füllung einer Zone sichtbar (die Antwort wird nie vorzeitig verraten).
      "Prüfen" hebt die richtige Zone grün hervor; eine falsche Wahl wird
      rot markiert. Rechteck- und Kreis-Zonen treffen beide korrekt, auch
      bei einem Klick genau auf den Rand einer Zone. "Nochmal versuchen"
      löscht die Auswahl; eine Lektion mit
      `requires_extensions: ["ext:al-hotspot@1"]` lädt (nicht vom Guard
      abgelehnt).
- [ ] TC-0350 Erstellung im Erweiterungs-Assistenten (#3110): im Editor für
      Erweiterungs-Aufgaben des Lektions-Erstellers je eine Aufgabe der drei
      neuen Typen anlegen - ordering (Schritte hinzufügen/entfernen),
      parsons (Code in das Textfeld tippen/einfügen; die Zeilenliste
      spiegelt die abgeleitete Einrückung), und hotspot (Bild
      auswählen/hochladen, eine Zone hinzufügen, ihre Form + 0-100-
      Koordinaten setzen, genau eine Zone als richtig markieren).
      "Speichern" ist mit einem Inline-Hinweis deaktiviert, bis die Nutzlast
      gültig ist (z. B. weniger als 2 Elemente, oder null/mehr als eine
      richtige Hotspot-Zone).
- [ ] TC-0351 Hotspot-Zeichenfläche zum Einzeichnen von Zonen (#3110): sobald ein
      Bild ausgewählt ist, erscheint oberhalb der numerischen Zonenliste
      eine Fläche "Zone auf dem Bild einzeichnen". Rechteck oder Kreis
      wählen, dann auf dem Bild ziehen - eine gestrichelte Vorschau folgt
      der Ziehbewegung und beim Loslassen wird eine neue Zone mit der
      gezeichneten Position/Größe angelegt (sofort sichtbar in den
      numerischen Feldern darunter zum Feinjustieren). Wird beim Ziehen
      der Bildbereich verlassen und dort losgelassen, wird das Zeichnen
      abgebrochen (keine Zone wird hinzugefügt). Die bereits vorhandenen
      Zonen werden auf der Fläche ebenfalls dargestellt (die richtige
      optisch abgesetzt), sodass die gesamte Anordnung beim
      Weiterzeichnen sichtbar bleibt.

### Set erneut durcharbeiten - zweiter Durchgang (#2125, EXP-051)

Ort: Meine Inhalte (`/content?tab=my`), Drei-Punkte-Menü eines Sets im
Status **Abgeschlossen**. Ein neuer Durchgang hebt den ersten für die
spätere Auswertung auf, statt ihn zu überschreiben oder zurückzusetzen.

- [ ] TC-0352 Ein Set als **Abgeschlossen** markieren -> im Drei-Punkte-Menü
      erscheint **"Erneut durcharbeiten"** (bei aktiven/zurückgestellten
      Sets NICHT vorhanden)
- [ ] TC-0353 Klick -> **einfache** Bestätigung ("Ein neuer Durchgang beginnt von
      vorne, der vorherige bleibt erhalten"), OHNE gezählte Löschmengen
- [ ] TC-0354 Bestätigen -> Toast "Ein neuer Durchgang wurde gestartet …", das Set
      steht wieder auf **Aktiv**, KEINE Fehlermeldung, kein Datenverlust
- [ ] TC-0355 Abbrechen -> nichts passiert, Status bleibt Abgeschlossen
- [ ] TC-0356 Nach dem Neustart eine zuvor gelernte Übung falsch beantworten -> die
      Wiederholungswarteschlange füllt sich **frisch** (kalte Planung; die
      Karten des ersten Durchgangs tauchen NICHT als überfällig auf)
- [ ] TC-0357 Set löschen (mit "Fortschritt löschen") -> ALLE Durchgänge des Sets
      verschwinden, keine verwaisten Zeilen
- [ ] TC-0358 Beides prüfen: Desktop/Server (API-Modus) UND iOS-PWA/GitHub Pages
      (Dexie-Modus) - der Ablauf muss in BEIDEN Modi funktionieren
- [ ] TC-0359 Backup-Rundlauf: Export -> Wipe -> Import; die Durchgänge (inkl. des
      abgeschlossenen ersten) überstehen den Import. Eine ältere Sicherung
      ohne Durchgangsdaten importiert als impliziter Durchgang 1 (kein Crash)

### Als Kopie bearbeiten - heruntergeladene Sets forken (#2654, EXP-046)

Ort: Meine Inhalte (`/content`), Drei-Punkte-Menü eines HERUNTERGELADENEN
(fremden) Sets - nicht bei eigenen "Meine Lektionen"-Sets, die haben direkt
"Bearbeiten".

- [ ] TC-0360 Ein heruntergeladenes Set öffnen -> im Drei-Punkte-Menü erscheint als
      ERSTER Eintrag **"Als Kopie bearbeiten"**
- [ ] TC-0361 Klick -> Bestätigungsdialog: Hinweis, dass das Original unverändert
      und weiterhin herunterladbar bleibt, PLUS der Fortschritts-Hinweis
      ("Eine Kopie startet ohne Lernfortschritt …")
- [ ] TC-0362 Abbrechen im Dialog -> nichts passiert, kein neues Set wird angelegt
- [ ] TC-0363 Bestätigen -> Toast "Als eigene Kopie gespeichert", die App wechselt
      automatisch in den Lektionseditor, VORBEFÜLLT mit dem Inhalt des
      Originals
- [ ] TC-0364 Die neue Kopie erscheint danach unter "Meine Lektionen"; das
      Original bleibt unverändert unter den heruntergeladenen Sets mit
      unverändertem Status und bleibt weiterhin herunterladbar
- [ ] TC-0365 Dieselbe Quelle ein zweites Mal als Kopie bearbeiten -> die zweite
      Kopie bekommt eine EIGENE, kollisionsfreie ID (z. B. `...-copy-2`),
      keine Überschreibung der ersten Kopie
- [ ] TC-0366 Beides prüfen: Desktop/Server (API-Modus) UND iOS-PWA/GitHub Pages
      (Dexie-Modus) - der Fork muss in BEIDEN Modi funktionieren

### Abstammung beim Fork - "Eigene Bearbeitung"-Badge + "basiert auf"-Credit (#2655, EXP-046)

Ort: Import-Tab (`/content?tab=import`), Abschnitt "Meine Lektionen" - jede
geforkte Kopie (egal ob per "Als Kopie bearbeiten", "Lektion importieren"
oder "Als Kopie speichern" im Lektioneditor entstanden).

- [ ] TC-0367 Ein heruntergeladenes Set (mit sichtbarem Autoren-Credit in einer
      Lektion, z. B. "Beigetragen von …") per "Als Kopie bearbeiten" forken
      -> die neue Kopie erscheint unter "Meine Lektionen" MIT dem Badge
      **"Eigene Bearbeitung"** neben dem Titel
- [ ] TC-0368 Darunter steht eine kompakte Zeile **"Basierend auf {Autor}"** -
      Mauszeiger/Tooltip auf der Zeile zeigt den Hinweis, dass Angaben
      selbst deklariert und nicht überprüft sind (KEIN Häkchen, KEIN
      "verifiziert"-Badge)
- [ ] TC-0369 Ein Set OHNE jeden Autoren-Credit forken -> Badge "Eigene Bearbeitung"
      erscheint weiterhin, aber KEINE "Basierend auf"-Zeile (nichts zu
      credititieren)
- [ ] TC-0370 Eine SELBST erstellte, nie geforkte Lektion ("Meine Lektionen" ohne
      vorherigen Import/Kopie-Schritt) zeigt WEDER das Badge NOCH eine
      Credit-Zeile
- [ ] TC-0371 Gleicher Ablauf über "Lektion importieren" (eine geteilte `.json`
      mit Autoren-Credit importieren) -> dieselben zwei Anzeigen
- [ ] TC-0372 Gleicher Ablauf über "Als Kopie speichern" im Lektioneditor (eine
      bereits geforkte eigene Lektion erneut als Kopie speichern) -> die
      neue Kopie trägt weiterhin denselben "basiert auf"-Credit (die
      Kette wächst nicht unbegrenzt)
- [ ] TC-0373 Beides prüfen: Desktop/Server (API-Modus) UND iOS-PWA/GitHub Pages
      (Dexie-Modus) - Badge + Credit-Zeile müssen in BEIDEN Modi erscheinen

### Teilen-Assistent - Hinweis + Entfernen für mitgereiste Fremd-Credits (#2656, EXP-046)

Ort: Teilen-Assistent (`ShareWizard`) Schritt 1, direkt unter dem
bestehenden "Dein Name (optional)"-Block. Voraussetzung für einen
sichtbaren Fremd-Credit: eine geforkte Lektion mit "basiert auf"-Credit
(#2655) oder eine importierte Lektion, deren `contributed_by` bereits
gesetzt ist, bevor der Assistent geöffnet wird.

- [ ] TC-0374 Eine eigene, nie geforkte Lektion teilen -> KEIN
      Fremd-Credit-Hinweis erscheint (nichts zu melden)
- [ ] TC-0375 Eine geforkte Lektion mit Set-Attribution (#2655) teilen -> der
      Hinweis "Dieser Inhalt nennt {Autor} als Urheber. Der Name reist
      beim Teilen mit, du kannst ihn entfernen." erscheint, MIT dem
      Namen aus der Attribution
- [ ] TC-0376 Eine importierte Lektion mit gesetztem `contributed_by`, aber ohne
      Set-Attribution teilen -> derselbe Hinweis, mit dem Namen aus
      `contributed_by`
- [ ] TC-0377 OHNE Klick auf "Credits entfernen" teilen -> der Fremd-Credit
      reist im geteilten Inhalt mit (Standardverhalten, jetzt sichtbar
      statt still)
- [ ] TC-0378 Klick auf "Credits entfernen" -> Button verschwindet, Bestätigung
      "Credits entfernt." erscheint; danach geteilt -> der Name taucht
      NICHT mehr im geteilten Inhalt auf (das strukturelle
      `variation_of` bleibt unberührt)
- [ ] TC-0379 Eigenen Namen eintragen UND "Namen anzeigen" aktivieren, OHNE
      Fremd-Credits zu entfernen -> der EIGENE Name gewinnt im geteilten
      Inhalt, der Fremd-Credit-Hinweis bleibt sichtbar, aber wird beim
      Teilen überschrieben (kein doppeltes Credit)
- [ ] TC-0380 Beides prüfen: Desktop/Server (API-Modus) UND iOS-PWA/GitHub Pages
      (Dexie-Modus) - Hinweis + Entfernen-Knopf müssen in BEIDEN Modi
      funktionieren

### Import/Export von Lektionen/Sets (#1672 / #1681 / #1685-Haertung)

Ort: Meine Inhalte (`/content?tab=my`) → "Lektion importieren"-Modal +
per-Karte "Exportieren" / "Als Set exportieren"; akzeptiert `.json` (eine
Lektion) + `.zip` (ganzes Set = `manifest.yaml` + `lessons/`).

- [ ] TC-0381 Import einer `.json`-Lektion: Vorschau zeigt Titel · Sprache · N
      Lektionen · M Übungen VOR dem Bestätigen
- [ ] TC-0382 Import eines `.zip`-Sets: Vorschau + korrekte Lektionszahl
- [ ] TC-0383 Namenskollision: Drei-Wege-Dialog erscheint (Überschreiben /
      Als Kopie importieren / Abbrechen), KEIN stilles Überschreiben;
      "Als Kopie" erzeugt neue id + "(Kopie)"-Titel
- [ ] TC-0384 **#2592 Überschreiben trägt den Lernfortschritt mit:** Set mit
      eigener Lektion anlegen, eine Übung falsch beantworten (damit eine
      Fehler-/Wiederholungszeile entsteht), das Set exportieren, in der
      exportierten Datei EINEN Antworttext korrigieren (z. B. Tippfehler in
      `free_text.accept[0]`), re-importieren → Kollisionsdialog →
      "Überschreiben". Erwartung: Toast "N Wiederholungskarte(n) übertragen",
      und die Fehlerhistorie zeigt die Zeile weiterhin (mit dem alten
      Fehlerzähler) unter dem NEUEN Antworttext — nicht als frische Zeile
      und nicht verschwunden. Vorher verwaiste die Zeile still.
- [ ] TC-0385 **#2592 unsicherer Fall meldet statt zu schweigen:** dieselbe Übung,
      aber in der Datei eine Übung LÖSCHEN (Positionen verschieben sich) →
      "Überschreiben". Erwartung: Hinweis-Toast "… konnte(n) nicht
      zweifelsfrei zugeordnet werden", kein stiller Verlust
- [ ] TC-0386 **#2592 "Als Kopie" bleibt unberührt:** derselbe Ablauf, aber
      "Als Kopie importieren" → das Original behält Fortschritt UND
      Wiederholungskarten, die Kopie startet ohne beides
- [ ] TC-0387 Teil-Import (ZIP mit kaputten Lektionen): gültige importieren,
      Warnung "N Lektion(en) übersprungen" wird angezeigt
- [ ] TC-0388 Set mit NUR kaputten Lektionen: sauberer Fehler, kein Crash
- [ ] TC-0389 Groessen-Guard: Datei > 5 MiB wird VOR dem Parsen freundlich
      abgelehnt; kaputtes JSON/ZIP nennt den Grund, kein Crash
- [ ] TC-0390 Round-Trip: Lektion exportieren → re-importieren → identisch in
      Meine Inhalte
- [ ] TC-0391 Create-Lesson "Als Datei speichern": Speichern-Schritt bietet
      Datei-Download der eben erstellten Lektion (kanonisches JSON)

### Create-Lesson-Wizard (`/create-lesson`, v2.3.0)

- [ ] TC-0392 **Schritt-1-Reihenfolge + Vorlagen-Aufklapper (#2755):** In Schritt 1
      steht das Pflichtfeld **Titel als erstes** (direkt unter der
      Überschrift, Fokus liegt darin). Die Vorlagen-Auswahl ist dahinter
      als Aufklapper "Aus einer Vorlage starten" **standardmäßig
      zugeklappt**; die zugeklappte Zeile zeigt die aktuelle Wahl
      ("· Leere Lektion" ist vorausgewählt). Aufklappen zeigt die vier
      Vorlagen-Karten plus "Wissenslektion aus Text" und "Erweiterte
      Aufgabentypen"; eine Karte wählen markiert sie gedrückt und die
      zugeklappte Zeile zeigt danach die neue Wahl.
- [ ] TC-0393 **Buchtext-Pfad (#1745):** Schritt 1 → Vorlagen-Aufklapper öffnen →
      Karte "Wissenslektion aus
      Text" (unter der Template-Auswahl) startet einen 3-Schritt-Flow
      (Metadaten → Buchtext → Review); Text einfügen + Generieren → KI
      formuliert Theorie in eigenen Worten + erzeugt Übungen; OHNE
      KI-Key: freundlicher Hinweis, kein Crash; "Weiter" erst nach
      erfolgreicher Generierung
- [ ] TC-0394 **Aufgabentyp-Auswahl im Assistenten (#2510):** Im Buchtext-Schritt
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
- [ ] TC-0395 **Reihenfolge der Typ-Auswahl (#2522):** Die Auswahl steht **oberhalb**
      des Lehrbuch-Textfelds, nicht darunter (erst sehen was erkannt wurde,
      dann Typen wählen, dann Text einfügen). **iOS-Standalone (PWA, kleines
      Gerät):** beim Öffnen des Buchtext-Schritts ist das Textfeld **ohne
      Scrollen** erreichbar - die Auswahl drückt es nicht unter die Falz; wer
      ein Kapitel einfügt, muss danach nicht nach oben scrollen, um die Typen zu
      finden. DOM-Reihenfolge entspricht der sichtbaren (keine Axe-Regression).
- [ ] TC-0396 **Erklärungen im Assistenten generieren (#2992):** Im Buchtext-Schritt
      steht direkt unter der Aufgabentyp-Auswahl das Kontrollkästchen
      "Erklärungen generieren (werden nach der Antwort gezeigt)" mit dem
      Hinweis zum Mehraufwand. Es ist bei JEDEM Öffnen des Schritts
      **abgewählt** (bewusst nicht gemerkt, weil es KI-Ausgabe kostet).
      Abgewählt generieren → die erzeugten Übungen tragen KEIN Feld
      `explanation` (im Inline-Editor ist das Erklärungsfeld leer). Angehakt
      generieren → Lückentext-, Wortkacheln-, Freitext-, Multiple-Choice- und
      Fehlerkorrektur-Übungen tragen eine Markdown-Erklärung (Regel, Wort für
      Wort, weitere Beispiele; in der Sprache des Textes), Zuordnung trägt
      keine; die Lektion abspielen und nach einer Antwort den Kasten
      „Erklärung" sehen (#2991). Beide Pfade prüfen: Einzeltext UND
      Datei-Upload mit mehreren Abschnitten (Batch).
- [ ] TC-0397 **Titel-Pflichtfeld im Buchtext-Pfad (#1946):** Schritt 1 OHNE
      Titel → Karte "Wissenslektion aus Text" klicken → bleibt auf
      Schritt 1 mit dem freundlichen Hinweis "Ein Titel ist
      erforderlich." (NICHT der Buchtext-Schritt, NICHT der rohe
      Schema-Fehler beim Speichern); mit Titel → Buchtext-Schritt
      öffnet normal und Speichern gelingt
- [ ] TC-0398 **[MOBILE] Titel-Warnung wird sichtbar gescrollt (#2036):** iPhone /
      schmaler Viewport, Schritt 1 OHNE Titel, nach unten zum Weiter-Button
      scrollen (Titelfeld oben ausserhalb des Sichtbereichs) → Weiter
      drücken: die Ansicht scrollt zum Titelfeld, das Feld erhält den Fokus
      und ist als ungültig markiert (roter Rahmen), der Hinweis "Ein Titel
      ist erforderlich." ist im Sichtbereich (KEIN Dead-End, keine Reaktion
      fehlt). Gilt für alle drei Einstiege: Weiter (Karten-Pfad), Karte
      "Wissenslektion aus Text" (Buch) und Karte "Erweiterungen" (Extension).
      Desktop-Regression: ist das Feld schon sichtbar, gibt es keinen
      Scroll-Sprung
- [ ] TC-0399 **Datei-Upload im Buchtext-Schritt (#1927):** Button "Aus Datei
      laden (EPUB, DOCX, TXT, MD)" über dem Textfeld; EPUB wählen →
      Abschnittsliste erscheint (Checkboxen, Titel + Zeichenzahl);
      Markdown-Datei → Split an Ueberschriften; TXT ohne Ueberschriften
      → ein Abschnitt; kaputte/zu grosse Datei (> 20 MiB) → klare
      Fehlermeldung, kein Crash; Rechte-Hinweis erwähnt Hochladen
- [ ] TC-0400 **DOCX-Upload (#1927, Phase 2b):** Word-Datei mit
      Ueberschrift-Formatvorlagen (auch deutsches Word, "Ueberschrift 1")
      → Kapitel werden erkannt und als Liste angeboten; Word-Datei OHNE
      Formatvorlagen (nur fett formatierte "Ueberschriften") → EIN
      Abschnitt "Gesamtes Dokument", Text landet trotzdem editierbar im
      Feld; kaputte .docx → klare Fehlermeldung, kein Crash
- [ ] TC-0401 **Mehrfachauswahl + Ausschluss-Heuristik + Batch (#1949):** Datei
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
- [ ] TC-0402 **KI-Uebungsgenerierung erzeugt Multiple-Choice (#2353):** eine
      Wissenslektion aus Text/Buchtext mit AI-Key generieren, deren Theorie
      klare Faktenfragen mit mehreren Antwortoptionen enthält (z. B. "Welche
      dieser Module gehören zu X?") → in der Vorschau "Generierte Übungen"
      erscheint mindestens gelegentlich ein Chip **"Multiple-Choice"** neben
      Matching/Cloze/Freitext/Wort-Kacheln; die gespeicherte Lektion spielt die
      MC-Übung ab (Einzelauswahl-Radio bzw. "Alle zutreffenden wählen"-
      Checkboxen), Feedback + SRS funktionieren wie bei den anderen Typen.
      Regression: die anderen fünf Typen entstehen weiterhin
- [ ] TC-0403 **KI-Uebungsgenerierung erzeugt Text-Extensions (#2355):** eine
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
- [ ] TC-0404 **Buchpfad bietet keine Bildauswahl mehr an + Set-Typenvielfalt
      (#2356):** ein Mehrfach-Abschnitts-Buchupload (mehrere Lektionen)
      generieren → KEINE der generierten Lektionen enthält eine
      **Bildauswahl**-Übung (im Buchpfad gibt es kein Bildmaterial, der Typ
      wird gar nicht mehr angeboten statt später verworfen); UEBER die
      Lektionen des Sets hinweg entstehen mehr als vier verschiedene
      Aufgabentypen (nicht nur cloze/matching/free_text/word_tiles). Regression:
      der Einzel-Buchpfad und die Set-Uebungsgenerierung erzeugen weiterhin
      gültige Lektionen
- [ ] TC-0405 **Lektion bearbeiten (#1740):** Meine Inhalte → Karte einer EIGENEN
      Lektion → Stift/Bearbeiten → Wizard öffnet vorausgefüllt; Review
      zeigt "Änderungen speichern" (überschreibt dieselbe id, Fort-
      schritt bleibt) + "Als Kopie speichern"; Fremd-Repo-Lektionen
      zeigen KEIN Bearbeiten; Analyse-Lektionen führen zur Import-Seite.
      **#2201:** "Als Kopie speichern" (und die Import-Kollision "Als
      Kopie importieren") zeigen den Hinweis, dass eine Kopie OHNE
      Lernfortschritt startet, während das Original seinen Fortschritt
      und seine Wiederholungskarten behält
- [ ] TC-0406 **Wiederholkarte übersteht Antwort-Korrektur (#2519):** eigene
      Lektion mit einer Freitext-Übung anlegen/speichern → üben, bis eine
      Wiederholkarte für diese Übung existiert (Wiederholungs-Warteschlange
      zeigt sie) → Lektion bearbeiten, Tippfehler in der akzeptierten
      Antwort korrigieren (z. B. "Merci" → "Merci !"), speichern.
      Erwartung: Toast "{N} Wiederholkarte(n) für die geänderte Antwort
      übernommen." erscheint, die Wiederholkarte bleibt (kein stiller
      Verlust der Fehler-/SRS-Historie). Gilt für BEIDE Speichermodi
      (API + Dexie)
- [ ] TC-0407 **Einfache Lektion (ohne Extension) bleibt speicherbar (#1919):**
      eine Lektion per Auto-Generieren erstellen (nur die sechs CORE-Typen,
      keine Extension-Übung), lokal speichern → über Bearbeiten erneut
      öffnen → zum Review blaettern: der Check "Gültige Lektionsstruktur"
      ist GRUEN und "Änderungen speichern" funktioniert (zuvor scheiterte
      es mit "ext_payload must be object" im API-/Server-Modus)
- [ ] TC-0408 **Buchtext-Lektion bearbeiten (#1967):** eine über "Wissenslektion
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
- [ ] TC-0409 **Kleine Buchtext-Lektion (< 5 Übungen) bearbeiten (#1970):** eine
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
- [ ] TC-0410 **Set mit mehreren Lektionen bearbeiten (Lektions-Auswahl, #1971):** ein
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
- [ ] TC-0411 **Lektionswechsel behält den Schritt (#2061):** ein Set mit mehreren
      Lektionen über "Lektion bearbeiten" öffnen, zu **Schritt 2 (Übungen)**
      navigieren (Übungsliste sichtbar) → im Dropdown "Lektion in diesem Set"
      eine ANDERE Lektion wählen → der Wizard BLEIBT auf Schritt 2, nur die
      Übungsliste wechselt auf die gewählte Lektion (vorher: Ruecksprung auf
      Schritt 1, "Weiter" musste erneut gedrückt werden). Gleiches auf
      Schritt 3 (Überprüfung): der Schritt bleibt erhalten. Randfälle: Wechsel
      auf eine Lektion OHNE Übungen zeigt eine leere Liste ohne Absturz und ohne
      Ruecksprung; bei ungespeicherten Änderungen erscheint weiterhin zuerst der
      "Lektion wechseln?"-Bestätigungsdialog. Desktop + iOS-Standalone prüfen
- [ ] TC-0412 **Buchangabe bleibt beim Bearbeiten erhalten (#1989):** eine Lektion über
      den Buchtext-Wizard MIT ausgefuellter "Buchangabe (optional)" (Titel,
      Autor, URL, ISBN/ASIN) erstellen + speichern → in der Lektion erscheint
      unter "Vertiefe das Thema" die Buchreferenz. Dann über "Lektion
      bearbeiten" öffnen, etwas ändern, speichern → die Buchangabe ist
      WEITERHIN vorhanden (vorher: verschwand nach dem ersten Bearbeiten). Über
      MEHRERE Bearbeitungszyklen bleibt sie erhalten; auch "Als Kopie speichern"
      übernimmt die Buchangabe. Regression: eine Lektion OHNE Buchangabe
      bekommt beim Bearbeiten KEIN leeres Buch-Objekt aufgezwungen
- [ ] TC-0413 **Alte englische Prompts migrieren beim Bearbeiten (#1860):** eine
      VOR #1855 erzeugte Alt-Lektion (Uebungsanweisungen fest englisch, z. B.
      "Match each word with its translation.") über "Lektion bearbeiten"
      öffnen → die betroffenen Anweisungen erscheinen automatisch in der
      UI-Sprache + ein dezenter, schliessbarer Hinweis oben ("... automatisch
      in deine Sprache übertragen"). NUR bei EXAKT dem alten Default: ein vom
      Nutzer bewusst abweichend gesetzter Prompt (auch zufällig englisch)
      bleibt unverändert. Editor ohne Speichern verlassen → Original in
      Dexie unverändert (kein stiller Schreibvorgang); erst Speichern
      (Überschreiben/Als Kopie) schreibt die migrierte Fassung dauerhaft
- [ ] TC-0414 **Lektionen kombinieren (#1741):** [E2E: `combine-lessons.spec.ts`] Meine Inhalte → "Zu Set
      kombinieren"-Umschalter → Checkbox-Auswahl (nur eigene Sets) →
      "Kombinieren"-Dialog: Neues Set (Titel Pflicht) vs. zu bestehendem
      Set; Originale bleiben erhalten; gemischte Sprachen/Level → nicht-
      blockierende Warnung
- [ ] TC-0415 **Gleiche-Sprache-Hinweis (#1721/#1730):** Quelle == Ziel zeigt
      neutralen Hinweis, blockiert "Weiter" NICHT; Save wird aktiv sobald die
      Checkliste passt
- [ ] TC-0416 **Inhaltsdomain-Auswahl in Schritt 1 (#1716):** Schritt 1 zeigt ein
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
- [ ] TC-0417 **Sprachpaar-Pruefpunkt (#1929):** Review zeigt SECHS Checklisten-
      Punkte (Titel, "Sprachpaar ist gültig", ≥4 Karten, ≥5 Übungen,
      ≥2 Typen, gültige Struktur). "Sprachpaar ist gültig" ist grün,
      sobald Quell- UND Zielsprache unterstuetzte Codes sind — ein
      Gleiche-Sprache-Paar (de → de) ist GUELTIG (kein "Quelle != Ziel"-
      Gate)
- [ ] TC-0418 **Struktur-Check-Grund (#1724):** fehlgeschlagener "Gültige
      Lektionsstruktur"-Check nennt einen konkreten Grund, nicht nur ✗
- [ ] TC-0419 **Interner Struktur-Fehler (#2384):** schlägt der "Gültige
      Lektionsstruktur"-Check mit einem INTERNEN Fehler fehl (z. B.
      `(0 , T.default) is not a function`), erklärt die Meldung, dass es
      ein Problem der App und NICHT der Lektion ist, nennt einen
      Neuladen/Erneut-versuchen-Weg und bietet einen "Problem melden"-Link
      — statt den technischen String als ungueltige Nutzer-Struktur zu
      praesentieren
- [ ] TC-0420 **Template-Titel (#1674/#1756):** Template-Karten zeigen lesbare
      Titel (auch offline) + einen gedrueckten/ausgewählten Zustand
- [ ] TC-0421 **Erweiterte Übungstypen / Extension-Wizard (#1852, #1887, #2817):** Schritt 1
      → Karte "Erweiterte Übungstypen" startet einen eigenen 3-Schritt-Flow
      (Autoren → Review → Speichern) mit einem nicht-blockierenden Hinweis,
      dass diese Typen fortgeschritten sind. Schritt 2: "Erweiterungsuebung
      hinzufügen" bietet sieben Typen — **Kategorisierung**, **Fehlerkorrektur**,
      **Leseverständnis**, **Benotetes Quiz**, **Diktat**,
      **Bildbeschreibung**, **Sprechen & Aufnehmen**. Je Typ öffnet der
      Inline-Editor mit den passenden Feldern; Speichern ist deaktiviert bis der
      shipped Validator erfuellt ist (Kategorisierung: ≥2 benannte Buckets mit
      Items; Fehlerkorrektur: ≥2 Wörter + markierter Fehler + Korrektur;
      Leseverständnis: Text + ≥1 vollständige Frage; Benotetes Quiz: ≥1 Frage
      mit positiven Punkten; Diktat: nicht-leerer Audio-Pfad + ≥1 akzeptierte
      Transkription; Bildbeschreibung: nicht-leeres Bild + ≥1 akzeptierte
      Antwort; Sprechen & Aufnehmen: nicht-leerer Satz, Audio-Referenz optional
      — ungewertet, kein "Übernehmen in Freitext"-Pfad). Leseverständnis + Benotetes Quiz: pro Frage Umschalten
      Multiple-Choice ⇄ Freitext, MC-Optionen mit Richtig-Haken, Benotetes Quiz
      zusätzlich Punkte + Teilpunkte + Bestehensgrenze. Diktat (#1887): ein
      getippter `assets/audio/...`-Pfad (kein Upload in v1) + die Liste der
      akzeptierten Transkriptionen. Review zeigt die Anzahl; "Lokal speichern" →
      gespeicherte Lektion **abspielbar** (jeder Typ rendert + ist beantwortbar);
      die Set-JSON trägt `requires_extensions: ["ext:al-...@1"]`
- [ ] TC-0422 **Diktat im Core-Typ-Picker (#1895):** Haupt-Wizard (kartenbasiert),
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
- [ ] TC-0423 **Erweiterungstypen im Core-Picker (#2508):** Haupt-Wizard (kartenbasiert),
      Schritt 3 "Übung generieren" → "Übung hinzufügen" öffnet "Übungstyp wählen".
      Unter den Standardtypen (sechs Core-Typen + Diktat) erscheint jetzt eine
      zweite, beschriftete Gruppe **"Erweiterungstypen"** mit Kategorisierung,
      Fehlerkorrektur, Leseverständnis, Benotetes Quiz, Bildbeschreibung und
      **Sprechen & Aufnehmen** (#2817; Diktat erscheint **nicht** doppelt).
      Klick auf einen dieser Knöpfe → eine
      Erweiterungsübung wird angehängt und öffnet direkt im Extension-Editor.
      Bildbeschreibung ist hier **wählbar** (das Bild wird im Editor ergänzt).
      "Lokal speichern" → die gespeicherte Lektion trägt
      `requires_extensions: ["ext:al-...@1"]` und ist abspielbar. **iOS-Standalone
      (zum Home-Bildschirm hinzugefügte PWA, Dexie-Modus):** Picker öffnet, beide
      Gruppen sind sichtbar und antippbar, die gewählte Erweiterungsübung wird
      gespeichert und rendert nach einem Reload. **Regression:** der separate
      Erweiterungs-Wizard funktioniert unverändert
- [ ] TC-0424 **Diktat-Audio-Upload (#1911, Slice 3):** Im Diktat-Editor (Core-Picker
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
- [ ] TC-0425 **Bildbeschreibung-Authoring (#2095):** Im Extension-Wizard
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
- [ ] TC-0426 **Sprechen & Aufnehmen-Authoring (#2817):** Im Extension-Wizard (Schritt
      1 → "Erweiterte Übungstypen") ODER im Core-Picker (Schritt 3, zweite
      Gruppe "Erweiterungstypen") **"Sprechen & Aufnehmen"** wählen. Der
      Editor zeigt ein Textfeld **"Zu sprechender Satz"** und darunter das
      (wiederverwendete) Audio-Feld aus dem Diktat-Editor ("Audio hochladen" +
      getippter Pfad, beides optional). Speichern ist deaktiviert, solange der
      Satz leer ist; ein Speichern **ohne jegliche Audio-Angabe ist erlaubt**
      (die Übung ist bewusst ungewertet — kein "Übernehmen"/Konvertieren-Pfad
      erscheint, anders als bei Diktat/Bildbeschreibung). Lektion speichern,
      im Viewer öffnen: die Lektion lädt **ohne `E-EXT-UNSUPPORTED`**, der
      Renderer erscheint (Lautsprecher-Button liest den Satz vor, "Text
      anzeigen" deckt ihn auf, eine Aufnahme-Steuerung lässt die Lernperson
      sich selbst aufnehmen). Mit hochgeladenem Referenz-Clip: der Player
      spielt den eigenen Clip statt der Geräte-TTS. Die gespeicherte Lektion
      trägt `requires_extensions: ["ext:al-speak-and-record@1"]`.
      **Regression:** Diktat + Bildbeschreibung funktionieren unverändert,
      insbesondere bleibt deren "→ Freitext"-Konvertierung sichtbar (nur bei
      Sprechen & Aufnehmen fehlt sie, by design)
- [ ] TC-0427 **Tastatur-Pre-Reveal (#3002, nur Touch-Geräte):** in einer Lektion
      ein Freitext- oder Lückentext-Feld antippen, das in der UNTEREN
      Bildschirmhälfte sitzt. Beim Fokussieren scrollt die Seite das Feld
      SOFORT ins obere Drittel (eigener App-Scroll, kein Sprung des ganzen
      Layouts), die Tastatur öffnet darunter, das Feld bleibt sichtbar.
      Danach: andere Elemente antippen, während das Feld fokussiert ist -
      die Tipps landen auf dem sichtbaren Ziel (kein 1-2-Zeilen-Versatz,
      das ist der #1569-Kern). Ein Feld, das schon OBEN sitzt, wird beim
      Fokussieren NICHT bewegt; Checkboxen/Radios/Dropdowns lösen keinen
      Scroll aus. Desktop (Maus): kein Scroll beim Fokussieren
- [ ] TC-0428 **Reiterleisten auf dem Telefon einzeilig (#3012):** auf einem echten
      Telefon im Hochformat nacheinander **Inhalte**, **Fortschritt** und
      **Dashboard** öffnen. Jede Reiterleiste steht in **einer** Zeile, keine
      Beschriftung ist abgeschnitten oder gequetscht, jeder Reiter ist
      mindestens 44px hoch antippbar. Vorher brach die Inhalte-Leiste auf
      schmalen Geräten (375px und darunter) unbemerkt in zwei Zeilen um.
      **Vergleich Tablet/Desktop:** dort sind die Reiter wieder grösser
      gesetzt und weiter gepolstert als auf dem Telefon; der Wechsel liegt
      bei 640px Fensterbreite (am Desktop die Fensterbreite verkleinern und
      den Umschlag beobachten). **Auswahl und Tastatur:** genau ein Reiter
      ist als aktiv markiert, Tabulator erreicht jeden Reiter, Enter wechselt
      ihn, die Adresse führt den Reiter mit (`?tab=`). **iOS-Standalone:** vom
      Home-Bildschirm gestartet gilt dasselbe; nach dem Drehen ins Querformat
      und zurück bleibt die Leiste einzeilig und springt nicht.
- [ ] TC-0429 **Erstellen-Knopf in "Meine Lektionen" (#3007):** Voraussetzung: es
      existiert mindestens eine eigene Lektion (sonst wird der Abschnitt gar
      nicht gezeigt). Inhalte → Importieren öffnen → im Abschnitt **Meine
      Lektionen** steht im Kopf neben "Zu einem Set zusammenfassen" der Knopf
      **"Neue Lektion erstellen"**. Klick → der Lektions-Assistent öffnet
      sich. Der Knopf bleibt auch sichtbar, während die Mehrfachauswahl zum
      Zusammenfassen aktiv ist. Auf dem Telefon: beide Knöpfe im Kopf sind
      mindestens 44px hoch und umbrechen sauber, der Titel bleibt lesbar.
      **iOS-Standalone:** vom Home-Bildschirm gestartet verhält sich der Knopf
      gleich, der Assistent öffnet in derselben Ansicht ohne Browser-Leiste.
- [ ] TC-0430 **Reiter "Erstellen" im Inhalte-Hub (#3006):** `/content` öffnen → die
      Reiterleiste zeigt **vier** Reiter: Entdecken, Meine Inhalte,
      Importieren, **Erstellen**. Klick auf Erstellen → der Lektions-Assistent
      erscheint im Reiter, die Adresse lautet `/content?tab=create`.
      **Alte Adresse:** `/create-lesson` direkt aufrufen → leitet auf
      `/content?tab=create` weiter, der Assistent ist da (kein 404, keine
      doppelte Seite). **Bearbeiten-Deeplink bleibt eigenständig:** bei einer
      eigenen Lektion "Bearbeiten" wählen → `/create-lesson/edit/...` öffnet
      den vorbefüllten Assistenten als eigene Seite, NICHT im Reiter.
      **Andere Einstiege:** der Knopf "Neue Lektion erstellen" auf dem
      Dashboard und der Link in Entdecken führen weiterhin zum Assistenten.
      **Im Importieren-Reiter** gibt es den Knopf "Neue Lektion erstellen"
      nicht mehr (der Reiter ersetzt ihn); die vier übrigen Aktionen
      (Lektion importieren, Chat importieren, Anki-Export, Lernpfad) sind
      unverändert da. **Reihenfolge:** Einstellungen → Allgemein → Reihenfolge
      der Inhalte-Reiter listet auch Erstellen und kann ihn verschieben; die
      neue Reihenfolge greift ohne Neuladen. Wer vor dieser Version eine
      eigene Reihenfolge gesetzt hatte, findet Erstellen am Ende der Liste,
      die übrigen drei unverändert.
      **Telefon (#3006 auf der Leiste aus #3012):** auf einem echten Telefon im
      Hochformat prüfen, ob die vier Reiter in EINE Zeile passen. Gemessen im
      Container (Chromium, deutsche Beschriftungen) brauchen sie mit der
      kompakten Leiste 337,1px und passen ab 375px Gerätebreite; ohne sie
      brauchten sie 451,7px und passten auf keinem Telefon. Auf einem sehr
      schmalen Gerät (320px, iPhone SE der ersten Generation) bricht die Leiste
      weiterhin in zwei Zeilen um - das ist der definierte Ausweg, kein Fehler.
      Bricht sie auf einem Gerät ab 375px um, ist das zu MELDEN: dann trägt die
      Messung nicht, und die Gegenmassnahme ist eine eigene Entscheidung.
      **iOS-Standalone:** die App vom Home-Bildschirm starten (ohne
      Browser-Leiste), `/content` öffnen → dieselbe Reiterleiste, Klick auf
      Erstellen wechselt den Reiter ohne Seitenwechsel, und der Zurück-Gestus
      führt nicht aus der App heraus. Danach die App aus dem
      App-Umschalter entfernen und neu starten → der zuletzt gewählte Reiter
      ist nicht "eingefroren", `/content` startet wieder auf dem ersten
      konfigurierten Reiter.
- [ ] TC-0431 **Aktualisierungs-Badge in der Kopfzeile (#2904):** ein installiertes
      Content-Set hat eine neuere Version (z. B. im Content-Browser bei einem
      Set "Aktualisierung verfügbar" antippen ODER die Set-Manifest-Version
      im Test-Repo erhöhen). Neu laden/App neu öffnen: **ohne** `/content`
      zu besuchen erscheint in der Kopfzeile neben dem Wiederholungs-Badge
      ein **Aktualisierungs-Badge** ("N Aktualisierungen") mit Link zu
      `/content?tab=my`. Klick → landet auf dem Tab **Meine Inhalte**
      (#2998: unabhängig von der in Einstellungen → Allgemein konfigurierten
      Tab-Reihenfolge, auch wenn Importieren oder Entdecken vorne steht),
      das betroffene Set zeigt dort **"Aktualisierung verfügbar"** in der
      Zeile (deckungsgleich mit dem Badge-Wert). **Alle anwenden (#3001):**
      den Kopfzeilen-Knopf **"Aktualisieren"** (`content-refresh`) drücken
      → die Liste wird neu geladen UND jedes Set mit "Aktualisierung
      verfügbar" wird nacheinander aktualisiert; der Knopf bleibt bis zum
      Ende deaktiviert, danach EIN Sammel-Toast "N Sets aktualisiert."
      (kein Toast pro Set). Ohne ausstehende Updates: Toast "Alle Sets sind
      aktuell.", kein Download. Ein Breaking-Update (#2128, Fortschritt
      betroffen) wird dabei NICHT angewendet: Hinweis-Toast "Zurückgehalten,
      weil dein Fortschritt betroffen wäre: <Set-Titel>. Bestätige jede
      Aktualisierung über den Aktualisieren-Knopf des Sets." (#3081: nennt
      JEDES zurückgehaltene Set beim Titel, mehrere durch Komma getrennt,
      und bleibt stehen, bis er über das X geschlossen wird), das Set behält
      "Aktualisierung verfügbar" und wird einzeln über den Zeilen-Knopf
      bestätigt. **Listenansicht (#3081):** in der Listenansicht (Umschalter
      rechts über der Liste) zeigt die Zeile des Sets den Marker
      "Aktualisierung verfügbar" und einen Download-Icon-Knopf
      (`content-list-set-<id>-update-button`, Tooltip "Aktualisieren"); auf
      dem Telefon (unter 640 px) rutschen Marker und Knopf als Gruppe in eine
      eigene Zeile unter den Titel (rechtsbündig, #3092), der Titel behält
      dieselbe Breite wie ohne Aktualisierung; Klick öffnet bei einem
      Breaking-Update denselben
      #2128-Schutzdialog wie der Kachel-Knopf, sonst wird direkt
      aktualisiert; aktuelle Sets zeigen weder Marker noch Knopf. **Nach dem
      Anwenden (#2985):** die Aktualisierung(en)
      auf `/content` durchführen (Kopfzeilen-Knopf, Zeilen-Knopf oder die
      Repo-Quelle synchronisieren) →
      der Badge-Zähler sinkt **sofort ohne Neuladen**; sind alle Updates
      angewendet, verschwindet das Badge (zurückgehaltene Breaking-Updates
      zählen weiter, bis sie manuell entschieden sind - das ist korrekt).
      **Kein Update vorhanden:** Badge erscheint **nicht**
      (kein leeres Pille-Element in der Kopfzeile). **Fehlertoleranz:**
      Netz beim App-Start ausschalten → kein Absturz, kein Fehler-Toast, die
      Kopfzeile rendert normal (das Badge bleibt einfach unsichtbar, es
      handelt sich um Begleit-Chrome, kein blockierender Ladezustand)
- [ ] TC-0432 **Multiple-Choice Single/Multi-Umschalter (#1888):** [E2E: `mc-single-multi-toggle.spec.ts`] Im MC-Inline-Editor
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
- [ ] TC-0433 **Erklärung im Inline-Editor (#2992):** Im Inline-Editor jeder Übung
      (Schritt 3, `ExerciseEditor` UND `ExtensionExerciseEditor`) steht unter
      den typspezifischen Feldern das Markdown-Textfeld **"Erklärung nach der
      Antwort (optional, Markdown)"** mit Hinweiszeile und Zeichenzähler
      "n / 2000 Zeichen". Solange das Feld leer ist, gibt es den Knopf
      **"Vorlage einfügen"**: ein Klick füllt das Gerüst (**Regel**, **Wort für
      Wort**, **Weitere Beispiele**, **Typischer Fehler**) ein und der Knopf
      verschwindet. Text eintippen, speichern, die Zeile erneut öffnen → der
      Text ist (getrimmt) da; die Lektion speichern und abspielen → nach der
      Antwort erscheint der Kasten „Erklärung" mit gerendertem Markdown
      (#2991). Feld komplett leeren und speichern → die gespeicherte Übung
      trägt KEIN `explanation`-Feld (kein leerer String im JSON). Mehr als
      2000 Zeichen sind nicht eintippbar (maxlength); eine geladene Übung mit
      längerer Erklärung zeigt "Die Erklärung ist zu lang …" und Speichern ist
      gesperrt, bis gekürzt wurde.
- [ ] TC-0434 **Aufgabentyp umwandeln -> Freitext (EXP-050 Stufe 1, #2511):** Im
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
- [ ] TC-0435 **Extension-Aufgabe umwandeln -> Freitext (EXP-050 Stufe 1, #2511):**
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
- [ ] TC-0436 **Fehlerkorrektur + Lückentext umwandeln -> Freitext (EXP-050 Stufe 2, #2511):**
      Beim Bearbeiten einer bestehenden Lektion:
      - Eine **Fehlerkorrektur**-Übung (`ext:al-error-correction`) trägt dasselbe
        "Aufgabentyp"-Auswahlfeld; "Freitext" wählen -> die akzeptierte Korrektur
        ist als Antwort vorbefüllt, **keine Rückfrage** (schlüsselerhaltend).
      - Ein **Lückentext** (Cloze, Modus Auswahl/Tippen) mit **genau einer
        Lücke**: "Freitext" wählen -> vorbefüllt, **keine Rückfrage**.
      - Ein **Lückentext mit mehreren Lücken**: "Freitext" wählen -> **es
        erscheint ein Bestätigungsdialog** ("Aufgabentyp umwandeln?", rot),
        weil nur die erste Antwort erhalten bleibt und der Lernfortschritt der
        übrigen nicht mitgenommen wird. **Bestätigen** wandelt um (erste Lücke
        als Freitext-Antwort), **Abbrechen** lässt den Lückentext unverändert.
      - Ein **Multiselect-Lückentext** trägt **kein** Auswahlfeld (nicht
        angeboten).
- [ ] TC-0437 **Freitext umwandeln -> Multiple-Choice / Lückentext (EXP-050 Stufe 3, #2511):**
      Beim Bearbeiten einer bestehenden Lektion eine **Freitext**-Übung öffnen.
      Das "Aufgabentyp"-Auswahlfeld bietet jetzt **"Multiple Choice"** und
      **"Cloze"** an.
      - **-> Multiple Choice:** die akzeptierte Antwort wird die **richtige
        Option**; sind im Freitext Distraktoren hinterlegt, füllen sie die
        falschen Optionen (dann direkt gültig). Ohne Distraktoren steht **eine
        leere Option** da und **"Speichern" ist gesperrt**, bis eine zweite,
        andere Option eingetragen ist (der Validator-Hinweis erscheint). Keine
        Rückfrage (schlüsselerhaltend).
      - **-> Cloze:** es entsteht ein Ein-Lücken-Cloze (`___`) mit der Antwort in
        der Lücke, direkt gültig; den Satz um die Lücke herum ergänzen und
        speichern.
      - Erwartung: `id`/`stable_id` unverändert, Lernfortschritt bleibt
        (gleicher Antwort-Schlüssel).
- [ ] TC-0438 **Benotetes Quiz <-> Leseverständnis umwandeln (EXP-050 Stufe 3b, #2511):**
      Beim Bearbeiten einer bestehenden Lektion (Zeile im `ExerciseGenerator`,
      nicht der reine "Extension hinzufügen"-Flow):
      - **Benotetes Quiz -> Leseverständnis:** im "Aufgabentyp"-Feld
        "Leseverständnis" wählen -> der Editor **bleibt der Extension-Editor**,
        die Fragen bleiben, aber die **Passage ist leer** und **"Speichern" ist
        gesperrt**, bis ein Text eingegeben ist. (Die Punkte pro Frage entfallen.)
      - **Leseverständnis -> Benotetes Quiz:** "Benotetes Quiz" wählen -> die
        Passage entfällt, jede Frage bekommt **1 Punkt** (direkt gültig), Bestehens-
        schwelle 60 %.
      - Randfall: hat eine Multiple-Choice-Frage **mehrere richtige** Optionen,
        erscheint der rote Bestätigungsdialog (Schlüssel wandert); sonst keine
        Rückfrage.
- [ ] TC-0439 **Leere Felder nach Umwandlung per KI vorschlagen (EXP-050 Stufe 4, #2511):**
      Nach einer Umwandlung (Stufe 3) das jeweils leere Zielfeld füllen lassen.
      Der Knopf erscheint **nur solange das Feld leer** ist (bei Multiple Choice:
      solange weniger als drei falsche Optionen vorhanden sind).
      - **Multiple Choice -> "Falsche Antworten per KI vorschlagen":** die
        richtige Antwort bleibt unberührt; die KI ergänzt die fehlenden falschen
        Optionen. Bereits eingetippte Optionen und die richtige Antwort werden
        **nie überschrieben**. Vorschläge, die der Antwort gleichen, zu kurz oder
        Dubletten sind, werden verworfen ("lieber einer weniger"); bleibt nichts
        übrig, erscheint der Hinweis, eine falsche Antwort von Hand zu ergänzen.
      - **Lückentext -> "Satz per KI vorschlagen":** nur wenn der Satz noch der
        blosse Platzhalter `___` ist -> die KI liefert einen Beispielsatz, in dem
        die Antwort als `___` erscheint. Danach ist der Knopf weg.
      - **Leseverständnis -> "Lesetext per KI vorschlagen":** nur bei leerer
        Passage und mindestens einer Frage -> die KI schreibt einen Lesetext zu
        den Fragen.
      - **Ohne eigenen KI-Schlüssel (BYOK):** der Knopf ist ausgegraut, aber
        antippbar; Tippen/Fokus zeigt einen Hinweis mit Link zu **AI-Einstellungen**
        und löst **keine** KI-Anfrage aus.
      - Unter jedem Knopf steht der Hinweis, dass es KI-Entwürfe sind, die vor dem
        Speichern zu prüfen und anzupassen sind. (Sichtprüfung: Desktop + Mobil.)
- [ ] TC-0440 **Token-Rollen annotieren (#3072):** Schritt 2, eine Karte anlegen
      (z. B. Vorderseite "der Hund in dem Garten", Rückseite "the dog in
      the garden"), dann auf der Zeile "Bearbeiten" öffnen. Unter dem
      Bildfeld steht "Token-Rollen (optional)". Prüfe der Reihe nach:
      (a) Ein Wort eintippen, das NICHT genau so in der Vorderseite steht
      (z. B. "Katze") -> "Hinzufügen" bleibt grau und darunter erscheint
      die Meldung, dass das Wort so nicht vorkommt. Gleiches bei falscher
      Groß-/Kleinschreibung ("der" statt "Der", wenn die Vorderseite
      groß beginnt). (b) Das Wort exakt wie in der Vorderseite eintippen,
      Rolle im Auswahlfeld wählen, "Hinzufügen" -> die Zeile erscheint
      mit Wort und Rollenname. (c) Dasselbe Wort noch einmal -> Meldung,
      dass es schon annotiert ist. (d) Das Auswahlfeld bietet GENAU
      sieben Rollen (Artikel, Substantiv, Verb, Adjektiv, Präposition,
      Genus-Marker, Tempus-Marker) und kein Freitextfeld. (e) Speichern,
      die Karte erneut zum Bearbeiten öffnen -> die Annotationen stehen
      noch da. (f) Telefon-Breite (unter 769 px, #3087): die Eingabezeile
      steht untereinander (Wortfeld volle Breite, Auswahlfeld volle
      Breite, "Hinzufügen" darunter), nichts ragt aus der Karte; ab
      Tablet-Breite bleibt sie einzeilig und das Wortfeld füllt den
      Restplatz.
- [ ] TC-0441 **Rollen vorschlagen (#3072):** In derselben Zeile "Rollen
      vorschlagen" klicken. Bei einer deutschen Vorderseite mit Artikeln
      und Präpositionen füllt sich die Liste (bei "der Hund in dem
      Garten": der = Artikel, in = Präposition, dem = Artikel).
      Substantive und Verben werden NICHT vorgeschlagen, das ist
      Absicht. Bei einer Vorderseite ohne solche Wörter (z. B. "Hund
      läuft") erscheint stattdessen der Hinweis, dass kein Wort erkannt
      wurde, und die Liste bleibt leer. Unter der Liste steht der
      Hinweis, dass Vorschläge geraten sind und jede Zeile geprüft
      gehört.

### Karten-Bild-Upload (#1763 / #1764) [E2E: `card-image-upload.spec.ts`]

Ort: Create-Lesson Schritt 2 (Karten-Editor), im Hinzufügen-Formular +
jeder Karten-Zeile (`CardImageField`).

- [ ] TC-0442 Feld "Bild (optional)" mit "Bild hochladen"-Button; nach Upload
      64x64-Vorschau + "Entfernen"
- [ ] TC-0443 Nur JPEG / PNG / WebP akzeptiert; anderer Typ → Inline-Fehler
      (role=alert), kein Crash
- [ ] TC-0444 Grosse Datei wird runterskaliert (≤512px Kante, ~150 KiB Kappe);
      undekodierbare Datei → Fehler statt Crash
- [ ] TC-0445 "Erweitert: Asset-Pfad verwenden" behält das manuelle
      `img/…png`-Feld (für repo-publizierte Sets)
- [ ] TC-0446 Round-Trip: Karte mit hochgeladenem Bild → exportieren →
      re-importieren → Bild erhalten
- [ ] TC-0447 Bekannte Grenze: hochgeladene data-URI-Bilder werden noch NICHT in
      einer gespielten picture_choice-Übung gerendert (Engine `src`-Kappe)

### Lesson-Player UX (v2.3.0)
- [ ] TC-0448 Pause-Button liegt jetzt im Sticky-Footer (#1644), Pausieren
      funktioniert von dort
- [ ] TC-0449 Position vor der ersten Übung (#3075): Lektion öffnen, nur durch zwei
      Theorieschritte blättern, KEINE Übung beantworten, Seite neu laden ->
      Resume-Dialog erscheint, "Fortsetzen" landet auf dem zuletzt offenen
      Schritt (vorher: Neustart bei Schritt 1 ohne Dialog)
- [ ] TC-0450 Pause-Knopf vor der ersten Übung (#3075): wie oben, dann den
      Pause-Knopf im Footer drücken -> der Dialog Weiter/Pausieren/Abbrechen
      erscheint (vorher: verliess die Lektion stumm); "Pausieren" -> die
      Lektion steht auf dem Dashboard unter "Pausierte Lektionen"
- [ ] TC-0451 Verlassen über die App-Navigation (#3075): eine Übung beantworten,
      dann zwei Theorieschritte weiter, dann über das Menü (Hamburger ->
      "Einstellungen"), das Logo oder den Zurück-Knopf des Browsers
      weggehen -> die Lektion steht unter "Pausierte Lektionen";
      "Fortsetzen" dort öffnet den Resume-Dialog und landet auf dem
      Theorieschritt, auf dem du warst (nicht auf der Übung davor); auf
      dem Handy dasselbe über die Menü-Schublade
      [E2E: `lesson-pause-position.spec.ts`]
- [ ] TC-0452 Auto-Weiter + "Zurück" (#1921): Einstellung "Automatisch weiter"
      (Settings -> Lernen) AN -> eine Übung richtig beantworten, die App
      springt automatisch zur nächsten Aufgabe -> dann "Zurück" klicken:
      die vorherige (bereits geloeste) Aufgabe bleibt stehen und springt
      NICHT sofort wieder vor; der "Weiter"-Button ist weiter klickbar
- [ ] TC-0453 Titelbereich schlanker, keine In-Lektion-Beschreibung mehr (#1635)
- [ ] TC-0454 Lektions-Zusammenfassung zeigt nur EINEN Favoriten-Button (#1649)
      [E2E: `lesson-summary-favorite.spec.ts`]
- [ ] TC-0455 Skip-to-Content-Link beim Tabben von oben sichtbar (#1727, a11y)
- [ ] TC-0456 **[MOBILE/VoiceOver, nicht blockierend] Auswahlfelder werden benannt
      angesagt (#2037):** iOS VoiceOver einschalten, `/create-lesson`
      Schritt 1 öffnen und über die Auswahlfelder (Domain, Sprache(n),
      Niveau) wischen: VoiceOver sagt jeweils das SICHTBARE Label plus den
      gewaehlten Wert an (z. B. "Niveau, A1, Auswahlfeld") - NICHT nur den
      Wert und nicht "Button" ohne Namen. Gleiches im Teilen-Assistenten
      und bei den Chat-Import-Sprachwaehlern. Automatisiert abgedeckt via
      axe (`select-a11y.spec.ts`); dieser Punkt ist die Gegenprobe mit
      echtem Screenreader in der nächsten iOS-Session

### Ungueltige Lektion: freundliche Fehlermeldung (#1808 / #1824)
- [ ] TC-0457 Deutsche Umlaut-Karten (`währung`, `präsenz`) laden korrekt
      (App akzeptiert Unicode-Kleinbuchstaben in Karten-ids/-tags, #1808)
- [ ] TC-0458 Eine tatsächlich kaputte Lektion zeigt AUSSERHALB des Entwickler-
      modus eine freundliche Meldung ("… ungueltige oder beschaedigte
      Daten … Autor kontaktieren"), NICHT den rohen Fehler-Dump (#1824)
- [ ] TC-0459 Mit Entwicklermodus AN (Settings): der technische Detail-Text
      erscheint wieder angehängt

### Diagnose-Sonde: Settings-Schalter + Protokoll (#2782)
- [ ] TC-0460 Einstellungen > Diagnose & Support: Schalter "Tipp- und
      Viewport-Sonde" einschalten - die Mess-Leiste erscheint SOFORT
      oben (ohne Neuladen); ausschalten entfernt sie sofort
- [ ] TC-0461 Mit aktiver Sonde: irgendwo tippen, dann in den Einstellungen
      "Protokoll kopieren" - die Zwischenablage enthält den Eintrag
      (Zeile mit `tap` und `deltaY=`); der Zähler daneben zeigt > 0
      aufgezeichnete Ereignisse
- [ ] TC-0462 Seite neu laden: der Zähler bleibt erhalten (Protokoll
      überlebt Reload); "Protokoll leeren" setzt ihn auf 0
- [ ] TC-0463 `?vvdiag=1` an die URL angehaengt aktiviert dieselbe Sonde;
      der Settings-Schalter zeigt danach AN (ein gemeinsames Flag)
- [ ] TC-0464 "Mess-Leiste anzeigen" AUS: die Leiste verschwindet sofort,
      Kopfbereich/Menü sind wieder frei - aber neue Taps erhöhen
      weiterhin den Protokoll-Zähler (Aufzeichnung läuft unsichtbar
      weiter, #2785)

### KI-Prüfung: Vorschläge übernehmen (AIV-07, #3060)
- [ ] TC-0465 Browser-Modus mit konfiguriertem KI-Schlüssel, eigene Lektion
      (Inhalte > Meine Inhalte) mit einem absichtlichen Fehler auf einer
      Karte (z. B. "casa" statt "la casa"); "Mit KI prüfen" ausführen:
      der Bericht listet die Karte, die Fußzeile trägt den Knopf
      "Vorschläge übernehmen"
- [ ] TC-0466 "Vorschläge übernehmen": eine Tabelle mit Lektion, Karte, Feld,
      "Aktuell" und "Vorschlag", jede Zeile angehakt; darunter die Zahl
      der Hinweise ohne übernehmbaren Wert (falls vorhanden); der
      Bestätigen-Knopf zählt "N Felder in M Karten"
- [ ] TC-0467 Eine Zeile abhaken, bestätigen: nur die angehakten Felder ändern
      sich (Lektion öffnen oder im Editor nachsehen), Titel, Sprachen,
      Niveau und Beschreibung des Sets bleiben; Toast "N Felder
      übernommen"; der Lernfortschritt der Lektion bleibt erhalten
- [ ] TC-0468 Im Ergebnis "Letzte Übernahme rückgängig machen": die Felder tragen
      wieder den alten Wert, Toast "Übernahme rückgängig gemacht."; der
      Undo-Knopf verschwindet
- [ ] TC-0469 Dialog schließen und "Mit KI prüfen" erneut öffnen: kein
      gecachter Bericht mehr, die Kostenschätzung erscheint (der Bericht
      wurde nach der Übernahme verworfen)
- [ ] TC-0470 Heruntergeladenes Set (nicht eigenes): "Vorschläge übernehmen"
      ist deaktiviert mit dem Tooltip "Nur für eigene Lektionen."

### Einstellungen > Plugins: Installierte Plugins (#3055)
- [ ] TC-0471 Desktop-App (API-Modus), Einstellungen > Plugins: oben die Karte
      "Installierte Plugins" mit einer Zeile je geladenem Plugin,
      alphabetisch: Name, Version, Quelle ("Paket") und der
      Aktivierungszeitpunkt in der App-Sprache formatiert; darunter
      unverändert die Karte "Lern-Repository"
- [ ] TC-0472 Direkt nach dem Öffnen steht kurz "Plugins werden gelesen…", dann
      die Liste; bei laufendem Backend kein Fehler, kein Toast
- [ ] TC-0473 Backend stoppen, Tab neu laden: die Karte zeigt die Zeile
      "Plugin-Status konnte nicht gelesen werden: …" und ein Toast trägt
      dieselbe Meldung; die Karte "Lern-Repository" bleibt sichtbar
- [ ] TC-0474 Browser-Modus (GitHub Pages / Dexie): die Karte bleibt sichtbar mit
      dem Hinweis "Nur mit der Desktop-App verfügbar."; DevTools >
      Netzwerk zeigt keinen Aufruf von /api/plugins/health

### Diagnose-Sonde: Fehltipp-Markierung + Aktionen (#3043)
- [ ] TC-0475 Sonde AN, Mess-Leiste sichtbar: die Leiste zeigt neben "Werte
      kopieren" und "Details" den Knopf "Daneben!"
- [ ] TC-0476 Irgendwo tippen, dann "Daneben!" antippen, dann "Details": der
      Bericht hat eine Sektion `actions (newest first)` mit einer
      `mark`-Zeile, deren `target=` das eben getippte Element nennt;
      der Tipp-Zähler ("N Tipps") ist durch den Knopf NICHT gestiegen
- [ ] TC-0477 Auf einer Lektionsseite eine Antwort-Kachel antippen: die
      `actions`-Sektion bekommt eine `click`-Zeile mit `target=`,
      `downTarget=` und `mismatch=0`; ein Textfeld antippen ergibt
      zusätzlich eine `focus`-Zeile mit `top=`/`bottom=`/`vis=`
- [ ] TC-0478 Die letzte Tipp-Zeile der Leiste trägt zusätzlich `hit=`,
      `above1=`, `above2=`, `pageY=`, `screenY=`, `hdrTop=`, `ftrBot=`,
      `room=` und `focusTop=`/`focusBot=`/`focusVis=`; in den
      Einstellungen "Protokoll kopieren" liefert dieselben Felder plus
      die `click`-/`focus`-/`mark`-Einträge

### Sticky-Knopf für die Mess-Leiste (#2799)
- [ ] TC-0479 Einstellungen > Diagnose & Support: "Sticky-Knopf für die
      Mess-Leiste" einschalten (Sonde muss AN sein) - ein runder
      schwebender Knopf erscheint SOFORT unten links
- [ ] TC-0480 Knopf antippen: die Mess-Leiste verschwindet (genau wie
      "Mess-Leiste anzeigen" AUS); erneut antippen: sie erscheint
      wieder - der Settings-Schalter "Mess-Leiste anzeigen" spiegelt
      jeden Tipp (ein gemeinsames Flag)
- [ ] TC-0481 Unter dem Schalter erscheint die Positionswahl (4 Ecken):
      "Oben rechts" wählen - der Knopf springt sofort in die Ecke;
      Standard ist "Unten links"
- [ ] TC-0482 Tipps AUF den Knopf tauchen NICHT im Diagnose-Protokoll auf
      (der Zähler in den Einstellungen bleibt beim Umschalten stehen)
- [ ] TC-0483 Mit aktiver unterer Tab-Leiste (#2786): der Knopf in einer
      unteren Ecke schwebt ÜBER der Tab-Leiste, verdeckt keine Tabs
- [ ] TC-0484 Sonde AUS: der Knopf verschwindet mit (ohne Sonde gibt es
      keine Leiste zum Umschalten)

### Menüposition mobil: untere Tab-Leiste als Option (#2786)
- [ ] TC-0485 Einstellungen > Allgemein > Oberfläche: "Menüposition (mobil)"
      steht auf "Oben (Menü-Knopf)" (Standard) - KEINE untere Leiste
- [ ] TC-0486 "Unten (Tab-Leiste)" wählen: die Leiste erscheint SOFORT unten
      (Lernen/Inhalte/Lernpfad/Fortschritt/Mehr); Inhalt wird nicht
      von ihr verdeckt (Scroll-Reserve unten)
- [ ] TC-0487 Mit unterer Leiste: Hamburger-Menü oben funktioniert weiterhin
- [ ] TC-0488 In einer laufenden Lektion und auf Landing/Onboarding/Assessment
      bleibt die Leiste verborgen (Lektions-Footer behält die Unterkante)
- [ ] TC-0489 Zurück auf "Oben": Leiste verschwindet sofort; Einstellung
      übersteht einen Reload

### Kopfzeile am Telefon: Menü-Knopf und Logo bleiben bei vielen Abzeichen (#3123)
- [ ] TC-0490 Telefon (375 und 430 px breit, z. B. iPhone 14 Pro Max) mit
      fälligen Wiederholungen, einer verfügbaren Set-Aktualisierung und
      XP: Dashboard öffnen. Der Menü-Knopf oben links hat seine volle
      Breite (kein schmaler Strich) und das Logo daneben ist sichtbar
- [ ] TC-0491 Die Abzeichen zeigen am Telefon nur die Zahl neben dem Symbol
      ("718" statt "718 fällig", "1" statt "1 Aktualisierungen");
      Tooltip bzw. Vorlesen nennt weiterhin den vollen Text
- [ ] TC-0492 Passen die Abzeichen nicht mehr neben Menü-Knopf und Logo, brechen
      sie rechtsbündig in eine zweite Zeile um; nichts wird abgeschnitten,
      die Seite scrollt nicht seitlich
- [ ] TC-0493 Tablet und Desktop: Kopfzeile unverändert einzeilig, Abzeichen mit
      vollem Text

### Schrittwechsel am Telefon: Anker oben, Fusszeile unten (#3126)
- [ ] TC-0494 iPhone (Safari oder PWA): eine Lektion mit einem langen
      Theorie-Schritt öffnen, bis ganz nach unten scrollen, dann "Weiter"
      auf einen kurzen Schritt (z. B. eine Zuordnungsübung)
- [ ] TC-0495 Ohne Wischen: der Schritt beginnt oben (Fortschrittsbalken und
      Aufgabe sichtbar), die Fusszeile mit Zurück/Pause/Prüfen sitzt am
      unteren Rand, keine leere (schwarze) untere Hälfte
- [ ] TC-0496 Dasselbe von einem kurzen auf einen langen Schritt: der Anker liegt
      oben, der Inhalt scrollt normal
- [ ] TC-0497 Mit "Bewegung reduzieren" im System: der Sprung erfolgt ohne
      Animation, Ergebnis gleich
- [ ] TC-0498 Gerät während eines Schritts drehen (#1422): der Schritt wird
      weiterhin neu verankert

### Einstellungen > Daten: Aufräum-Karten (#2955)
- [ ] TC-0499 Einstellungen > Daten: die Karte "Maximale Lektionsgröße" steht
      direkt unter "Offline-Cache"; die Karte "Pausierte Lektionen
      aufbewahren" steht direkt über "Nicht verbundene Inhalte" (gibt es
      keine nicht verbundenen Inhalte, direkt über der Gefahrenzone)
- [ ] TC-0500 Einstellungen > Lernen endet mit "Erinnerungen"; beide Karten sind
      dort nicht mehr
- [ ] TC-0501 "Schritte pro Teil" auf 15 setzen, Seite neu laden: der Wert
      bleibt 15; "Pausierte Lektionen behalten für" auf "60 Tage"
      stellen, neu laden: die Auswahl bleibt "60 Tage"
- [ ] TC-0502 Beides im Browser-Modus wiederholen (Einstellungen > Daten >
      Speichermodus): gleiches Verhalten

### Position + Navigation im Set (#2793)
- [ ] TC-0503 In einer Lektion aus einem Set steht oben "Lektion N von M" mit
      der richtigen Nummer
- [ ] TC-0504 Der Pfeil nach links öffnet die VORIGE Lektion des Sets; der
      Pfeil nach rechts die nächste
- [ ] TC-0505 In der ersten Lektion fehlt der Links-Pfeil (kein toter Knopf),
      die Anzeige bleibt; in der letzten fehlt der Rechts-Pfeil
- [ ] TC-0506 Nach dem Sprung zeigt die Anzeige die neue Position
- [ ] TC-0507 Bei einer Einzel-Lektion ohne Set (z. B. eigene Lektion) fehlt
      die Positionszeile vollständig

### Erstanzeige: keine Sprachmischung (#2796)
- [ ] TC-0508 App bei deutscher Oberfläche neu laden (Cache leeren): Startseite,
      Navigation, Installations-Hinweis, Update-Banner und Offline-Meldung
      sind sofort deutsch - kein englischer Text, kein roher Schlüssel
      wie `landing.intro`
- [ ] TC-0509 Dasselbe im Flugmodus/offline: die Texte bleiben deutsch (die
      Erstanzeige braucht kein Netz)
- [ ] TC-0510 Update-Banner: "Was ist neu?", "Release-Seite", "Später" sind
      lesbar beschriftet (nicht leer, ausreichender Kontrast)

### Auswertung am Set-Ende (#2792)
- [ ] TC-0511 Letzte Lektion eines Sets abschließen: auf der Abschluss-Karte
      steht "Auswertung ansehen" als erste Aktion, "Set ansehen"
      daneben
- [ ] TC-0512 Die Auswertung zeigt vier Kennzahlen (Fehler insgesamt,
      gemeistert in Prozent, noch offen, Lernzeit) und darunter
      Fehler nach Lektion, nach Aufgabentyp und die größten
      Schwachstellen mit eigener falscher Antwort neben der richtigen
- [ ] TC-0513 Die zwei mittleren Kennzahlen folgen den Fehlern, nicht der
      Wiederholungs-Marke (#3166): "Noch offen" zählt die Elemente mit
      mindestens einem Fehler, die die Wiederholung noch nicht als
      gemeistert führt; "Gemeistert" ist der Anteil aller gespielten
      Elemente, die nie falsch waren oder ihren Fehler seither abgetragen
      haben. Ein Set mit 12 gespielten Elementen, 3 davon einmal falsch:
      "3 Fehler insgesamt", "75 % Gemeistert", "3 Noch offen" - nicht
      "0 %" und "12"
- [ ] TC-0514 "Fehler trainieren" führt in die Wiederholung des Sets,
      "Zurück zum Set" auf die Set-Seite
- [ ] TC-0515 Ein Set ohne aufgezeichnete Fehler zeigt die freundliche
      Meldung statt leerer Abschnitte
- [ ] TC-0516 Beides im Browser-Modus (ohne Server) prüfen - die Zahlen
      kommen dort aus der lokalen Datenbank

### Lernpfad-Set: "Alles wiederholen" setzt die Ergebnisse zurück (#3171)
- [ ] TC-0517 Lernpfad öffnen, ein Set mit Ergebnissen aufklappen: in der
      Aktionsleiste steht "Alles wiederholen" (`set-reset-results-<id>`)
      neben "Fehler trainieren"; ein nie begonnenes Set zeigt den Knopf
      nicht
- [ ] TC-0518 Knopf drücken: die Bestätigung "Alle Ergebnisse zurücksetzen?" nennt
      den Set-Titel, die Zahl der Lektionen mit Ergebnis, dass Punktzahl,
      Sterne und Lernzeit zurückgesetzt werden, dass die Fehler des
      bisherigen Durchgangs als Verlauf bleiben und dass XP und Abzeichen
      unverändert sind; darunter "Bisheriger Schnitt: N %" (bei einem Set
      ohne bewertete Lektion "Noch kein Schnitt vorhanden.")
- [ ] TC-0519 "Abbrechen" (auch Escape): nichts ändert sich, Sterne und Fortschritt
      des Sets sind wie vorher
- [ ] TC-0520 "Zurücksetzen und neu starten": Erfolgs-Toast, Lektion 1 des Sets
      öffnet sich; zurück im Lernpfad steht das Set ohne Sterne und ohne
      Fortschritt, "Fehler trainieren" ist verschwunden (neuer Durchgang,
      wie bei "Erneut durcharbeiten")
- [ ] TC-0521 Ein Set, das in "Meine Inhalte" als "Abgeschlossen" oder
      "Zurückgestellt" markiert war, steht nach dem Reset wieder unter
      "Aktiv" (Statusfilter in "Meine Inhalte"); das Dashboard führt es
      unter "Weitermachen" wieder als begonnenes Set, nicht als erledigt
- [ ] TC-0522 Dashboard: XP-Stand und Abzeichen sind nach dem Reset unverändert
- [ ] TC-0523 Beides prüfen: Desktop-App (API-Modus) und Browser-Modus ohne Server
      (Dexie) - der Reset schreibt in beide Speicher

### Set-Seite: Lektionsliste + Fortschritt (#2793 Stufen 2-3)
- [ ] TC-0524 Eine Set-Seite öffnen (/content/set/<id> oder über einen
      geteilten Link): unter den Set-Angaben steht die Liste ALLER
      Lektionen mit Nummer
- [ ] TC-0525 Rechts oben an der Liste steht "{x} von {y} Lektionen
      abgeschlossen"
- [ ] TC-0526 Abgeschlossene Lektionen zeigen ein grünes Häkchen plus ihre
      Punktzahl; die erste unfertige trägt die Marke "Hier weitermachen"
      (#2935)
- [ ] TC-0527 Ein Klick auf eine beliebige Zeile öffnet genau diese Lektion -
      auch eine weit zurückliegende
- [ ] TC-0528 In einer laufenden Lektion ist der Set-Name in der Kopfzeile
      anklickbar und führt auf ebendiese Liste
- [ ] TC-0529 Ohne angemeldeten Lernfortschritt erscheint die Liste trotzdem,
      nur ohne Markierungen
- [ ] TC-0530 Ein paar Lektionen eines Sets abschließen, verlassen, die
      Set-Seite erneut öffnen, "Lernen starten" drücken: es öffnet die
      erste UNFERTIGE Lektion, nicht wieder Lektion 1 (#2935)
- [ ] TC-0531 Jede Lektion eines Sets abschließen, dann erneut "Lernen starten"
      drücken: es öffnet Lektion 1 (nichts mehr zum Fortsetzen)
### Zusammenfassung: Alle Antworten mit Frage (#2807)
- [ ] TC-0532 Lektion beenden, "Alle Antworten ansehen" öffnen (Abschnitt
      "Antworten-Übersicht" in den Einstellungen eingeschaltet oder
      "Ausführliche Auswertung" gedrückt, #3124): jede Zeile mit etwas zu
      zeigen ist aufklappbar (Titel + Punktzahl bleibt sichtbar)
- [ ] TC-0533 Aufgeklappt steht die FRAGE über den Antworten - auch bei einer
      teilrichtigen Zeile wie "2 / 3", die vorher gar nichts zeigte
- [ ] TC-0534 Bei Auswahl-/Zuordnungsaufgaben (ohne Textantwort) erscheinen
      Frage und richtige Antwort
- [ ] TC-0535 Bei Textantworten bleibt der farbige Wort-Vergleich, ergänzt um
      die eigene Antwort im Klartext
- [ ] TC-0536 Eine vollständig richtige Zeile zeigt ihre Frage, aber keinen
      Fehler-Vergleich

### Zusammenfassung: Ausführliche Auswertung auf Knopfdruck (#3031)
- [ ] TC-0537 Lektion beenden: direkt unter der Überschrift steht der Knopf
      "Ausführliche Auswertung"
- [ ] TC-0538 In Einstellungen > Lernen > "Zusammenfassung nach Lektionen" einen
      eingeschalteten Abschnitt abschalten (z. B. "XP-Belohnung"), dann
      eine Lektion beenden: der Abschnitt fehlt - nach Druck auf
      "Ausführliche Auswertung" ist er da
- [ ] TC-0539 Im ausführlichen Zustand ist "Alle Antworten ansehen" schon
      aufgeklappt
- [ ] TC-0540 "Warum du diese verpasst hast" erscheint auch dann, wenn sein
      eigener Schalter aus ist, und zeigt mehr als fünf Fehler, sofern
      der Durchgang mehr hatte
- [ ] TC-0541 Erneut drücken ("Kompakte Auswertung"): alles ist wieder wie
      vorher, der abgeschaltete Abschnitt ist wieder verschwunden
- [ ] TC-0542 Zurück in die Einstellungen: die abgeschalteten Abschnitte sind
      unverändert abgeschaltet - der Knopf speichert nichts
- [ ] TC-0543 Die Korrektur-Runde bleibt auch ausführlich zugeklappt (auf dem
      Telefon springt keine Tastatur auf)
- [ ] TC-0544 Beim Umschalten bleibt der Knopf an seiner Stelle, die Seite
      springt nicht weg

### Zusammenfassung: ausführliche Auswertung wie am Set-Ende (#3124)
- [ ] TC-0545 Lektion mit mindestens zwei Fehlern beenden, "Ausführliche
      Auswertung" drücken: direkt unter dem Knopf steht "Auswertung:
      <Lektionstitel>" mit "Alle Fehler dieser Lektion auf einen Blick"
- [ ] TC-0546 Darunter vier Kennzahlen (Fehler insgesamt, Gemeistert, Noch offen,
      Lernzeit), "Fehler nach Aufgabentyp" und "Größte Schwachstellen" mit
      der eigenen falschen Antwort durchgestrichen neben der richtigen;
      "Fehler nach Lektion" gibt es hier NICHT (es ist nur eine Lektion)
- [ ] TC-0547 Erster Durchlauf einer Lektion, z. B. 12 Elemente, 9 richtig, 3
      falsch: "3 Fehler insgesamt", "75 % Gemeistert", "3 Noch offen" -
      dieselben 75 % wie die Punktzahl des Durchlaufs (#3166). "Gemeistert"
      zählt die Elemente, die nie falsch waren oder deren Fehler die
      Wiederholung seither abgetragen hat, "Noch offen" die mit Fehler und
      ohne Meisterung; nicht "0 %" und "12" bei 3 Fehlern
- [ ] TC-0548 Die Zahlen stimmen mit der Set-Auswertung (Inhalte > Set >
      "Auswertung ansehen") für dieselbe Lektion überein
- [ ] TC-0549 "Fehler trainieren" führt in die Wiederholungs-Sitzung des Sets
- [ ] TC-0550 Ohne Fehler im Durchgang: "Keine Fehler aufgezeichnet - stark!"
      statt der Kennzahlen
- [ ] TC-0551 "Kompakte Auswertung": die Auswertung verschwindet wieder; die
      #3031-Punkte (Abschnitte, Antworten, Erklärungen) gelten weiterhin
- [ ] TC-0552 Tooltip des Knopfs nennt Kennzahlen, Aufgabentypen und Schwachstellen

### Zusammenfassung: kompakte Voreinstellung, ein Bildschirm (#3124)
- [ ] TC-0553 Frische Installation (oder in Einstellungen > Lernen >
      "Zusammenfassung nach Lektionen" nur "Ergebnis und Statistik" und
      "XP-Belohnung" angehakt): Lektion beenden - die Zusammenfassung zeigt
      Sterne, Punktzahl, Zeit, "+N XP" und direkt darunter "Als
      abgeschlossen markieren", "Nächste Lektion", "Nochmal üben" und
      "Zurück"; kein Favoriten-Hinweis, kein Teilen, keine
      Antworten-Übersicht, kein Export, kein "Warum du diese verpasst
      hast", keine Korrekturrunde, keine Nächste-Schritte-Karten
- [ ] TC-0554 Am Telefon (Hochformat): alles bis zu den Weiter-Knöpfen ohne
      Wischen sichtbar
- [ ] TC-0555 "Ausführliche Auswertung": die Auswertung wie am Set-Ende und alle
      abgeschalteten Abschnitte erscheinen (Favorit, Teilen, Alle Antworten
      aufgeklappt, Export, "Warum du diese verpasst hast", Fehler
      ausbessern, Nächste Schritte); "Kompakte Auswertung" nimmt sie wieder
      weg
- [ ] TC-0556 Einstellungen > Lernen > "Zusammenfassung nach Lektionen": neun
      Zeilen, "Warum du diese verpasst hast" steht direkt über der Zeile
      der Korrekturrunde; nur Ergebnis und XP sind angehakt; eine Zeile
      anhaken (z. B. Nächste-Schritte-Vorschläge), Lektion beenden: der
      Abschnitt ist dauerhaft in der kompakten Fassung
- [ ] TC-0557 Bestehende Wahl bleibt: wer die Abschnitte vor diesem Stand schon
      einmal eingestellt hatte, sieht seine Auswahl unverändert; "Warum du
      diese verpasst hast" ist dort angehakt und steht direkt über der
      Korrekturrunde
- [ ] TC-0558 "Warum du diese verpasst hast" angehakt, aber "Erklärungen nach der
      Antwort" (Wiederholung) aus: der Block fehlt in der kompakten Fassung
      und erscheint erst in der ausführlichen Auswertung

Hinweis zu allen Schritten dieses Plans, die Export, Teilen, Favorit, Alle
Antworten, "Warum du diese verpasst hast", Fehler ausbessern oder die
Nächste-Schritte-Karten nutzen: den Abschnitt vorher in den Einstellungen
einschalten oder "Ausführliche Auswertung" drücken (#3124).

### Lektion verlassen führt zum Set (#2811)
- [ ] TC-0559 In einer Set-Lektion pausieren und verlassen: die App landet auf
      der SET-Seite mit der Lektionsliste, nicht auf "Meine Inhalte"
- [ ] TC-0560 Nach der Zusammenfassung "Verlassen": ebenfalls die Set-Seite -
      die gerade beendete Lektion ist dort als abgeschlossen markiert
- [ ] TC-0561 Eine Lektion ohne Set (eigene Lektion, Einzelimport) landet
      weiterhin auf "Meine Inhalte"

### Ergebnis als Bild teilen (#2813)
- [ ] TC-0562 Nach einer Lektion neben "Teilen" den Knopf "Nur Bild teilen"
      drücken: die Teilen-Auswahl öffnet sich MIT der Ergebniskarte und
      OHNE Text/Link
- [ ] TC-0563 In Facebook auswählen: es entsteht ein Bild-Beitrag mit der Karte
      (nicht das allgemeine App-Bild)
- [ ] TC-0564 WhatsApp funktioniert weiterhin über den normalen "Teilen"-Knopf
      (Karte plus Text)
- [ ] TC-0565 Am Desktop (ohne Teilen-Auswahl): das Bild wird heruntergeladen,
      Meldung "Bild gespeichert"
- [ ] TC-0566 Teilen-Auswahl abbrechen: keine Datei landet still im
      Download-Ordner

### Neuer Tab "Diagnose & Support" vereint Fehlerbericht + Sonde (#2789)
- [ ] TC-0567 Einstellungen > Info: zwischen "Hilfe" und "Über" steht jetzt
      "Diagnose & Support"
- [ ] TC-0568 Dort zuerst der Support-Abschnitt mit "Fehlerbericht erstellen"
      (früher unter "Über"), darunter die Diagnose-Sektion mit
      Entwicklermodus (früher unter "Allgemein > Oberfläche") und der
      Tipp-/Viewport-Sonde (früher unter "Allgemein > Diagnose")
- [ ] TC-0569 "Über" zeigt weiterhin Version, Strang und Links, aber keinen
      Support-Knopf mehr
- [ ] TC-0570 "Allgemein" zeigt weiterhin Menüposition, aber keinen
      Entwicklermodus-Schalter und keine Diagnose-Sektion mehr
- [ ] TC-0571 Direkter Link `?tab=diagnostics` öffnet den Tab unmittelbar

### Discover + Registry (seit v2.2.0)
- [ ] TC-0572 Source-Language-Filter als sichtbarer Chip auf erster Ansicht
      (nicht mehr hinter "Filter" versteckt), "Alle Sprachen" persistiert
      über Reload (#1699/#1701)
- [ ] TC-0573 Referenz-/Demo-Sets (graded-quiz-demo) erscheinen NICHT in
      Discover/Meine Inhalte (#1702/#1706)
- [ ] TC-0574 Per-Set Share-Link öffnet direkt die Set-Detailseite (#1572)
- [ ] TC-0575 Registrierten Content-Repo hinzufügen (register-a-repo #1511)
- [ ] TC-0576 Manifest-Fallback für eigene Repos ohne search-index.json (#2562):
      eigenes Repo über Settings → Daten → "Repository hinzufügen" verbinden,
      das NIE mit dem Engine-Generator gebaut wurde (kein search-index.json
      an der Wurzel) - Sets erscheinen trotzdem in Entdecken; sobald mehr als
      eine Quelle beiträgt, erscheint der Filter "Quelle" (vorher fehlte er
      bei nur einer beitragenden Quelle)
- [ ] TC-0577 "Als Repository teilen" (#2376): ein Set mit Qualitätsmängeln
      (z. B. Zuordnungsübung mit doppeltem linkem Wert) wird beim ersten
      Klick NICHT gepusht - die Mängelliste erscheint, der Button wechselt
      auf "Trotzdem exportieren"; erst der zweite Klick exportiert
- [ ] TC-0578 "Als Repository teilen" (#2376): bei Lektionsdateien, deren Namen
      nicht in Quellreihenfolge sortieren (kapitel-1..kapitel-10), meldet
      der Erfolgs-Screen die Umbenennung mit NN-Präfixen; das exportierte
      Repo listet die Lektionen in Quellreihenfolge

### Discover Stufe 1: Facetten, Marken, Leerzustand (EXP-048, #2320-#2324)

Ort: Entdecken (`/content?tab=discover`). In BEIDEN Speichermodi prüfen
(API + Dexie); die Facetten lesen den Suchindex und sind modusunabhängig.

- [ ] TC-0579 Zielsprache-Facette neben der Quellsprache sichtbar; Marken tragen ihre
      Trefferzahl, nur belegte Ziele der aktiven Quellsprache, nach Menge
      sortiert; Auswahl filtert die Liste (#2322)
- [ ] TC-0580 Durchsichtsstand: maschinell erzeugte Sets (z. B. ja-a1-from-de,
      ko-a1-from-de, zh-a1-from-de) tragen ein neutrales Abzeichen
      ("Maschinell erstellt"), handgeschriebene Sets KEIN Abzeichen; die
      Facette "Durchsicht" erscheint nur, wenn solche Sets im Katalog sind
      (#2321)
- [ ] TC-0581 "KI-geprüft"-Facette ist verschwunden; das KI-Abzeichen am Eintrag
      bleibt (#2321)
- [ ] TC-0582 Aktive Einschränkungen (Niveau, Bereich, Vertrauen, Durchsicht, Suche)
      stehen als entfernbare Marken über der Liste; ein Klick auf das X einer
      Marke löst genau diese Einschränkung (#2323)
- [ ] TC-0583 Bereichs-Namen sind übersetzt (Hundetraining, Technik, Software,
      Philosophie, Verkehrskunde statt roher Bezeichner) (#2320)
- [ ] TC-0584 Leerzustand: bei null Treffern erscheinen berechnete Auswege
      ("Ohne <Facette>: N Sets") und "Alle Filter zurücksetzen"; ein Klick
      stellt Treffer wieder her; die Quellsprache bleibt erhalten (#2324)
- [ ] TC-0585 Leere Bibliothek (kein Set): Hinweis auf "Eigene Quelle hinzufügen"
      (/add-repo) bzw. "eine Lektion anlegen" (/create-lesson) (#2324)
- [ ] TC-0586 Telefon (schmale Breite): die Markenzeile bleibt EINE waagerecht
      scrollbare Zeile, bricht nicht um und frisst nicht die halbe Höhe
- [ ] TC-0587 **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):**
      gleicher Ablauf auf dem iPhone-PWA - die Facetten-Menüs öffnen über
      der Liste (Portal/Fixed, #1349), die Markenzeile scrollt waagerecht, und
      die Leerzustand-Auswege sind tippbar (>=44px Touch-Ziel)

### Discover Stufe 2: Einstiege, Quellen-Facette, Sprachnamen-Suche (EXP-048, #2329-#2331)

Ort: Entdecken (`/content?tab=discover`). In BEIDEN Speichermodi prüfen
(API + Dexie); die Facetten lesen den Suchindex und sind modusunabhängig.

- [ ] TC-0588 Einstieg-Steuerung ("Ich möchte") als erste dauerhaft sichtbare Marke;
      drei Vorbelegungen mit Trefferzahl: Sprache lernen / Fachgebiet / Alles
      (#2331)
- [ ] TC-0589 Vorbelegung "Sprache lernen" (Standard beim ersten Besuch): nur
      Sprachsets; Zielsprache- und Niveau-Facette sichtbar, Bereichs-Facette
      ausgeblendet (#2331)
- [ ] TC-0590 Umschalten auf "Fachgebiet": nur Wissenssets; Bereichs-Facette sichtbar,
      Niveau- und Zielsprache-Facette ausgeblendet; die Wahl bleibt nach einem
      Reload gemerkt (#2331)
- [ ] TC-0591 "Alles" zeigt beide Populationen; Umschalten löscht die vom neuen
      Einstieg ausgeblendeten Einschränkungen, sodass die Liste nicht still
      auf null fällt (#2331)
- [ ] TC-0592 Quellen-Facette: erscheint, sobald mehr als eine Quelle vorhanden ist;
      Auswahl schränkt auf diese Quelle ein, mit Trefferzahl je Quelle (#2330)
- [ ] TC-0593 Sprachnamen-Suche: die Oberfläche auf Englisch stellen und "Spanish"
      eingeben findet die deutschsprachigen Spanisch-Sets (Sprachnamen der
      UI-Sprache sind durchsuchbar) (#2329)
- [ ] TC-0594 Telefon (schmale Breite): die Einstieg-Marke reiht sich in die EINE
      waagerecht scrollbare Markenzeile ein, bricht nicht um
- [ ] TC-0595 **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):**
      gleicher Ablauf auf dem iPhone-PWA - das Einstieg-Menü öffnet über der
      Liste (Portal/Fixed, #1349), die Vorbelegung bleibt nach dem Beenden der
      PWA gemerkt, und die Suche nach Sprachnamen funktioniert

### Discover Stufe 3: schubweises Rendern (EXP-048, #2333)

Ort: Entdecken (`/content?tab=discover`). Um über 24 Treffer zu kommen, den
Einstieg auf "Alles" und die Quellsprache auf "Alle Sprachen" stellen. In
BEIDEN Speichermodi prüfbar; die Logik ist modusunabhängig.

- [ ] TC-0596 Bei mehr als 24 Treffern werden zunächst 24 gezeigt; "Weitere anzeigen"
      lädt den nächsten Schub; die Trefferzahl über der Liste bleibt die volle
      Zahl (#2333)
- [ ] TC-0597 Kein Endlos-Scrollen; nach dem letzten Schub verschwindet der Knopf
- [ ] TC-0598 Eine Filter-, Such- oder Sortieränderung setzt auf den ersten Schub
      zurück
- [ ] TC-0599 Gilt in Karten- und Listenansicht
- [ ] TC-0600 **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):**
      "Weitere anzeigen" ist tippbar (>=44px), und der Zurück-Weg (Geste /
      Navigation) bleibt nach dem Nachladen erhalten

### Discover Stufe 3: Tippfehler-Toleranz + Rangfolge in der Suche (EXP-048, #2336)

Ort: Entdecken (`/content?tab=discover`), Suchfeld. Schwelle bewusst
überschritten: das Merkmal war laut Exploration erst ab etwa 200 Sets
vorgesehen (aktuell rund 46) und wird auf ausdrückliche Nutzer-Entscheidung
schon jetzt gebaut. In BEIDEN Speichermodi prüfbar; die Logik ist
modusunabhängig.

- [ ] TC-0601 Ein Suchwort mit EINEM Tippfehler (z. B. "spanissch" statt "Spanisch")
      findet dieselben Sets wie die korrekte Schreibweise
- [ ] TC-0602 Zwei oder mehr Tippfehler im selben Wort finden das Set NICHT (die
      Toleranz bleibt eng)
- [ ] TC-0603 Sehr kurze Suchwörter (unter 4 Zeichen) bleiben exakt; ein 3-Zeichen-
      Tippfehler findet nichts Falsches
- [ ] TC-0604 Bei einer Mehrwort-Suche muss weiterhin JEDES Wort passen; ein
      unpassendes zweites Wort schließt das Set aus
- [ ] TC-0605 Exakte Treffer stehen über reinen Tippfehler-Treffern, wenn nach
      "Relevanz" sortiert wird
- [ ] TC-0606 **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):** die
      Tippfehler-Suche funktioniert ohne Netz genauso wie im Server-Modus

### Discover Stufe 3: Sprachpaar-Auswahl (alternativer Einstieg, aufklappbar) (EXP-048, #2337, #2359)

Ort: Entdecken (`/content?tab=discover`), Bereich "Sprachpaare" über der
Trefferliste. Schwelle bewusst überschritten: laut Exploration erst ab etwa 30
belegten Paaren vorgesehen (aktuell 14) und auf ausdrückliche
Nutzer-Entscheidung schon jetzt gebaut. Sichtbar im Einstieg "Sprache lernen"
und "Alles", sobald mehr als ein Sprachpaar belegt ist. In BEIDEN
Speichermodi prüfbar; die Logik ist modusunabhängig.

- [ ] TC-0607 Über der Liste steht EIN aufklappbarer Knopf, standardmäßig ZU; ohne
      Auswahl trägt er "Sprachpaar wählen (N)" mit der Paarzahl (#2359)
- [ ] TC-0608 Aufklappen (Klick/Tippen auf den Knopf) zeigt die belegten Paare, nach
      QUELLSPRACHE gruppiert (Überschrift je Quellsprache, darunter die Ziele
      mit Trefferzahl, das meistbelegte zuerst); erneutes Tippen klappt zu
      (#2359)
- [ ] TC-0609 Ein Tippen auf ein Ziel setzt Quell- UND Zielsprache zugleich und
      schaltet auf den Einstieg "Sprache lernen"; die Liste zeigt danach nur
      noch die Sets dieses Paars (#2337)
- [ ] TC-0610 Nach der Wahl fasst der eingeklappte Knopf sie zusammen, z. B.
      "Deutsch → Spanisch"; das gewählte Ziel ist im aufgeklappten Zustand
      hervorgehoben (aktiv markiert) (#2359)
- [ ] TC-0611 Ein Paar in einer ANDEREN Erklärsprache (z. B. Gruppe "Englisch",
      Ziel "Spanisch") springt auch dorthin; die Quellsprache bleibt danach
      frei änderbar (#2337)
- [ ] TC-0612 Im Einstieg "Fachgebiet" erscheint die Sprachpaar-Auswahl nicht (#2337)
- [ ] TC-0613 Fahnen-Icons: vor jedem Sprachnamen steht ein Flaggen-Emoji - in den
      Gruppen-Überschriften und Ziel-Knöpfen der Paar-Auswahl UND in den
      Quell-/Zielsprache-Menüs; der Sprachname bleibt daneben stehen, sodass
      auf Plattformen ohne Flaggen-Emoji (z. B. Windows) weiter der Name lesbar
      ist (#2359). Hinweis: eine Sprache ist kein Land, die Zuordnung ist eine
      bewusste Konvention (Englisch -> UK, Portugiesisch -> Portugal)
- [ ] TC-0614 Tastatur: der Knopf ist mit Tab erreichbar und mit Enter/Leertaste auf-
      und zuklappbar; im aufgeklappten Zustand sind die Ziel-Knöpfe per Tab
      erreichbar (#2359)
- [ ] TC-0615 Telefon (schmale Breite): eingeklappt kostet die Auswahl EINE Zeile;
      aufgeklappt bleibt der Inhalt scrollbar und frisst nicht die halbe Höhe
      (#2359)
- [ ] TC-0616 **iOS-Standalone (zum Home-Bildschirm hinzugefügt, Dexie-Modus):** der
      Aufklapp-Knopf und die Ziel-Knöpfe sind tippbar (>=44px), das Auf- und
      Zuklappen funktioniert, und die Auswahl wirkt ohne Netz genauso wie im
      Server-Modus (#2359)

### Set-Status bleibt erhalten (aktiv/zurückgestellt/abgeschlossen, beide Modi)

Ort: Meine Inhalte (`/content?tab=my`) → Set-Aktionen-Menü (Drei-Punkte)
eines heruntergeladenen Sets. In BEIDEN Speichermodi prüfen (Desktop/
Server = API-Modus; GitHub-Pages-PWA = Dexie-Modus), da der Bug früher nur
im API-Modus auftrat.

- [ ] TC-0617 Set auf **Zurückgestellt** setzen → in eine andere Maske wechseln
      (z. B. Dashboard) → zurück zu Meine Inhalte → Status ist WEITERHIN
      "Zurückgestellt" (nicht wieder "Aktiv")
- [ ] TC-0618 Rueckweg prüfen: einmal über das Menü/Navigation, einmal über den
      Browser-Zurück-Button
- [ ] TC-0619 Alle Übergänge testen: aktiv → zurückgestellt → abgeschlossen →
      wieder aktiv; jeder bleibt nach einem Maskenwechsel erhalten
- [ ] TC-0620 Zweite Stufe (echter Persistenz-Beweis): App komplett schliessen und
      neu öffnen → zurückgestellter Status ist noch da
- [ ] TC-0621 iPhone-PWA: gleicher Ablauf (dort ursprünglich beobachtet)

### Weitermachen-Vorschlag: Rangfolge und sichtbarer Set-Abschluss (#2123, #3020)

Ort: Dashboard → Übersicht, oberster Block "Weitermachen" / "Continue
Learning". In BEIDEN Speichermodi prüfen (API + Dexie), die Logik ist
modus-unabhängig.

- [ ] TC-0622 Ein Set komplett durchspielen (alle Lektionen abschliessen) ODER über
      das Set-Aktionen-Menü auf "Abgeschlossen" setzen, KEINE fälligen
      Wiederholungskarten → die Zeile trägt sichtbar das Abschluss-Tag
      "Set abgeschlossen" (Häkchen-Symbol, Sterne der letzten Lektion) und
      verschwindet NICHT stillschweigend
- [ ] TC-0623 Klick auf die abgeschlossene Zeile → führt zurück in die zuletzt
      bearbeitete Lektion des Sets (Nachschlagen bleibt möglich)
- [ ] TC-0624 Gleichzeitig ein angefangenes Set vorhanden → das angefangene Set steht
      OBEN, das abgeschlossene darunter; der Abschluss ist nie der oberste
      Vorschlag
- [ ] TC-0625 Mehrere abgeschlossene Sets → höchstens EINES wird getaggt angezeigt
      (das zuletzt abgeschlossene), der Block wird kein Abschluss-Archiv
- [ ] TC-0626 Weder ein offenes noch ein abgeschlossenes Set und keine fälligen Karten
      → ehrlicher Leerzustand ("Starte deine erste Lektion", Link zu Meine
      Inhalte) statt irgendein Set als Lueckenfueller
- [ ] TC-0627 Abgeschlossenes Set MIT fälligen Wiederholungen → erscheint als
      Wiederholungs-Zeile ("N Elemente fällig") und führt in die
      Wiederholungs-Session (`/review/{setId}`), nicht als Abschluss-Tag
- [ ] TC-0628 Zurueckgestelltes Set ohne faellige Karten → wird NICHT angezeigt
      (bewusst weggelegt, es gibt keinen Abschluss zu melden)
- [ ] TC-0629 Angefangenes (aktives) Set → wird weiterhin zum Fortsetzen vorgeschlagen
- [ ] TC-0630 Reihenfolge: faellige Wiederholungen zuerst, dann angefangene Sets, zuletzt
      das abgeschlossene Set (innerhalb jeder Stufe zuletzt-bearbeitet zuerst)

### Weitermachen: jede Zeile per X ausblendbar (#3023)

Ort: Dashboard → Übersicht, Block "Weitermachen". In BEIDEN Speichermodi
prüfen (API + Dexie), die Ablage ist modus-unabhängig (localStorage +
Dexie-userData-Spiegel).

- [ ] TC-0631 Jede Zeile trägt rechts ein X - unabhängig vom Modus: Fortsetzen,
      Nächste Lektion, fällige Wiederholung, abgeschlossenes Set
- [ ] TC-0632 Klick auf das X: die Zeile verschwindet sofort, eine kurze Meldung sagt,
      dass sie wiederkommt, sobald weitergelernt wird
- [ ] TC-0633 Neu laden: die Zeile bleibt weg (die Entscheidung ist gespeichert)
- [ ] TC-0634 Nichts wurde gelöscht: das Set steht unverändert in "Meine Inhalte",
      der Lernfortschritt der Lektion ist erhalten, die Wiederholungskarten
      sind unverändert (Anzahl in der Wiederholungs-Kachel prüfen)
- [ ] TC-0635 Selbstheilung: die ausgeblendete Lektion erneut öffnen und bearbeiten →
      die Zeile taucht im Dashboard wieder auf
- [ ] TC-0636 Alle Zeilen ausblenden → ehrlicher Leerzustand ("Starte deine erste
      Lektion"), kein leerer Block ohne Erklärung
- [ ] TC-0637 Backup-Runde: Export → Daten löschen → Import → die ausgeblendeten
      Zeilen sind weiterhin ausgeblendet (der Zustand reist im .alb mit)
- [ ] TC-0638 Telefon: das X ist ohne Zielverfehlung antippbar und löst NICHT den
      Zeilen-Link aus (44 px Trefferfläche)

### Weitermachen: Schrittzähler nennt den Wiedereinstieg (#3076)

Ort: Dashboard → Übersicht, Block "Weitermachen", Zeile "Fortsetzen". Vorher
zählte "Aufgabe 1/8" die bewerteten Übungen; die Wiederaufnahme landete auf
einem anderen Schritt.

- [ ] TC-0639 Eine Lektion mit acht Schritten öffnen, die erste Übung beantworten,
      dann zwei Theorieschritte weiter (Schritt 4), über das Menü verlassen
- [ ] TC-0640 Dashboard: die Zeile zeigt "Fortsetzen · Schritt 4/8" (nicht "1/8")
- [ ] TC-0641 Klick auf "Fortsetzen" → Resume-Dialog → "Fortsetzen" landet auf genau
      dem Schritt, den die Zeile nennt
- [ ] TC-0642 Bis zur Zusammenfassung spielen, ohne "Als abgeschlossen markieren",
      über das Logo weggehen → die Zeile zeigt "Schritt 8/8", nie "9/8"

### Update-Schutz: kein stiller Fortschrittsverlust beim Set-Update (#2128)

Ort: Meine Inhalte, ein bereits GELERNTES Set (Fortschritt + Wiederholungskarten
vorhanden), für das ein Update verfügbar ist. In BEIDEN Speichermodi prüfen.
Hintergrund: ein Update, das Übungs-/Karten-Identitäten ändert (z. B. eine
Antwort-Korrektur), würde Wiederholungskarten verwaisen. Der Schutz hängt an
einem echten Alt-gegen-neu-Vergleich, nicht an einem pauschalen Abschalten.

- [ ] TC-0643 Vorbereitung: ein Set lernen (mind. eine Lektion, ein paar Fehler erzeugen
      -> Wiederholungskarten), für das eine geänderte Fassung mit GEAENDERTER
      Antwort/Kartenfront bereitsteht.
- [ ] TC-0644 Manuelles Update anstossen (Button "Update" am Set): Es erscheint eine
      Bestätigung mit bezifferter Angabe ("N Wiederholungskarten / N Lektionen
      würden zurückgesetzt"), NICHT ein stilles Überschreiben.
- [ ] TC-0645 "Aktuelle Version behalten" -> nichts wird aktualisiert, Fortschritt bleibt,
      Set zeigt weiterhin "Update verfügbar" (sichtbar + erneut entscheidbar).
- [ ] TC-0646 "Trotzdem aktualisieren" -> Update wird angewendet.
- [ ] TC-0647 Harmloses Update (nur neue Lektion/Übung ergänzt, keine bestehende
      Kennung geändert) -> KEINE Nachfrage, läuft direkt durch.
- [ ] TC-0648 Auto-Sync (nur bei verbundenem Nutzer-Repo, 24h): ein identitaets-aenderndes
      Update wird im Hintergrund NICHT still angewendet; das Set bleibt auf der
      bisherigen Fassung und zeigt "Update verfügbar" (kein Hintergrund-Dialog,
      kein Datenverlust).
- [ ] TC-0649 iOS-Standalone (PWA): gleicher manueller Ablauf, Bestätigung erscheint.
- [ ] TC-0650 Übernahme-Vorschlag (#2308): Im Bestätigungsdialog erscheint zusätzlich
      eine Liste "alt -> neu" der Wiederholungen, die übernommen werden könnten,
      plus ein Haken "Gelernten Fortschritt übernehmen" (standardmäßig gesetzt,
      WEIL die Paare darüber sichtbar sind).
- [ ] TC-0651 Mit gesetztem Haken bestätigen: Nach dem Update sind Fehlerzähler, Serie
      und Beherrschungs-Status an der KORRIGIERTEN Antwort vorhanden (die
      Wiederholung startet nicht bei null). Toast nennt die Anzahl.
- [ ] TC-0652 Haken ENTFERNEN und bestätigen: Update läuft, es wird NICHTS übernommen
      (Verhalten wie vor #2308). Der Haken ist die Entscheidung, nicht Deko.
- [ ] TC-0653 Nicht zuordenbare Fälle: Wurde in einer Übung die REIHENFOLGE geändert
      oder ein Element eingefügt/entfernt, nennt der Dialog diese getrennt
      ("N lassen sich nicht sicher zuordnen und werden zurückgesetzt"). Prüfen,
      dass für diese NICHTS übernommen wurde - eine falsche Zuordnung wäre
      schlimmer als ein Verlust, weil sie unsichtbar ist.
- [ ] TC-0654 AUTH-05: Übungskennung selbst geändert (nicht nur die Antwort) - z. B.
      eine Übung ohne `stable_id` wird beim Update umbenannt (Slug-Wechsel).
      Die Zählung im Haken "Gelernten Fortschritt übernehmen" schließt diesen
      Fall mit ein (kombinierte Zahl aus Übungs- und Element-Ebene); die
      lesbare Vorschauliste zeigt weiterhin nur Antworttext-Paare, keine
      rohen Übungs-Slugs. Nach Bestätigen mit Haken: die Wiederholkarte
      bleibt unter der NEUEN Übungskennung erhalten, kein Neustart bei null.
- [ ] TC-0655 Auto-Sync (24h, verbundenes Nutzer-Repo): Es wird WEDER aktualisiert NOCH
      etwas übernommen. Die Zuordnung darf nur im manuellen Dialog entstehen.
- [ ] TC-0656 Zweimal hintereinander bestätigen (Update erneut anstossen): keine
      doppelte Übernahme, keine Fehlermeldung (idempotent).
- [ ] TC-0657 Sicherung vorher: Der Hinweis auf eine Sicherung ist ein Angebot, kein
      Zwang - das Update lässt sich auch ohne Sicherung bestätigen.
- [ ] TC-0658 iOS-Standalone (PWA): Dialog samt Paar-Liste und Haken ist vollständig
      lesbar und bedienbar (Liste läuft nicht aus dem Dialog, der Haken ist
      antippbar), Übernahme funktioniert im Dexie-Modus genauso.
- [ ] TC-0659 Sprache prüfen (#2160): der Bestätigungstext erscheint in der App-Sprache
      (nicht englisch), in mehreren Sprachen stichprobenartig (de/ja/ko/el/hi).
- [ ] TC-0660 Erst-Prägung (engine#91, Element-Ebene): Set, dessen Paare/Lücken/Optionen
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

- [ ] TC-0661 Update eines Sets mit deklarierten Ausmusterungen anwenden (manuell oder
      Sync): Es erscheint EIN Hinweis-Toast mit der Anzahl ("N Übungen wurden
      vom Autor ausgemustert; der zugehörige Lernfortschritt ist archiviert.").
- [ ] TC-0662 Nur-Ausmusterungs-Update (keine sonstigen Identitäts-Änderungen):
      KEIN Warndialog (#2128) - die Ausmusterung ist erklärt, nicht brechend;
      das Update läuft durch, nur der Hinweis-Toast erscheint.
- [ ] TC-0663 Nach dem Update: die ausgemusterten Elemente erscheinen NICHT mehr in der
      Wiederholungs-Warteschlange und zählen NICHT mehr in die "N fällig"-Zahl.
- [ ] TC-0664 Update erneut anstoßen: kein zweiter Toast, keine Doppel-Archivierung
      (idempotent; Zahl wäre 0, kein Hinweis).
- [ ] TC-0665 Sprache prüfen: der Hinweis erscheint in der App-Sprache (de/ja/ko
      stichprobenartig).

### Wiederherstellung: Wiederholungsfortschritt nach ja/ko/zh-Korrektur (#2161)

Ort: Dashboard (Übersicht). Hintergrund: die drei A1-Sets Japanisch, Koreanisch
und Chinesisch wurden im Juli 2026 mit einer Umschrift-Korrektur neu
veroeffentlicht, die die Antworttexte von 172 Wiederholungs-Elementen aenderte
(66 ja / 58 ko / 48 zh). Wiederholungskarten haengen am Antworttext, also fielen
bereits angelegte Karten für die geänderten Elemente still aus der Planung.
In BEIDEN Speichermodi prüfen. Nur diese drei Sets sind betroffen; alle anderen
Sets bleiben unberührt.

- [ ] TC-0666 Vorbereitung: eines der Sets (ja/ko/zh A1) in der ALTEN Fassung lernen und
      ein paar Wiederholungskarten erzeugen, dann auf die korrigierte Fassung
      bringen (bzw. Testdaten mit den alten Antwort-Keys).
- [ ] TC-0667 Der Hinweis erscheint auf dem Dashboard NUR, wenn tatsächlich betroffene
      Karten in den eigenen Daten liegen. Kein Hinweis, wenn nichts betroffen ist.
- [ ] TC-0668 Der Hinweis nennt je betroffenem Set die Anzahl betroffener Karten und
      bietet "Sicherung erstellen" an (empfohlen, nicht erzwungen).
- [ ] TC-0669 "Sicherung erstellen" -> es wird dieselbe .alb-Datei wie unter
      Settings → Daten erzeugt (Toast mit Dateiname).
- [ ] TC-0670 "Wiederholungskarten neu verknuepfen" -> beziffertes Ergebnis
      ("N neu verknuepft, N bereits korrekt"). Danach verschwindet der Hinweis
      für dieses Set (kein erneutes Nachfragen).
- [ ] TC-0671 Idempotenz: erneut auslösen (bzw. Seite neu laden) ändert nichts mehr;
      der Hinweis kommt für dieses Set nicht zurück.
- [ ] TC-0672 Teil-Wiederherstellung: falls ein Set nach der Korrektur erneut geändert
      wurde, werden nicht zuordenbare Karten als Anzahl gemeldet und unverändert
      gelassen (nicht still verworfen).
- [ ] TC-0673 "Set neu beginnen" -> Inline-Rückfrage, erst nach Bestätigung werden
      Fortschritt + Wiederholungskarten dieses Sets entfernt; danach ist der
      Hinweis für das Set weg.
- [ ] TC-0674 Kein Doppel-Mapping / keine verwaisten Zeilen: nach dem Neu-Verknuepfen
      keine Wiederholung auf einer falschen Karte, keine doppelten Karten.
- [ ] TC-0675 Backup-Verhalten: eine VOR der Wiederherstellung erstellte Sicherung
      importieren -> die alten (verwaisten) Keys sind wieder da, der Hinweis
      erscheint erneut und lässt sich erneut anwenden.
- [ ] TC-0676 iOS-Standalone (PWA): gleicher Ablauf, Hinweis + beide Aktionen
      funktionieren.
- [ ] TC-0677 Sprache prüfen: Hinweis- und Ergebnistexte erscheinen in der App-Sprache
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

- [ ] TC-0678 Auf dem Telefon das Dashboard öffnen. Erscheint der Hinweis von selbst,
      liegen ECHTE betroffene Daten vor -> dort testen. Dann gilt die
      Produktbedingung: VORHER "Sicherung erstellen" (Knopf im Hinweis).
- [ ] TC-0679 Erscheint auf dem Telefon kein Hinweis, wandert die Prüfung auf den
      DESKTOP; dort den Zustand herstellen. Ein verwaister Eintrag entsteht nicht
      mehr über die normale Bedienung (die korrigierte Fassung erzeugt bereits
      den neuen Key), daher braucht dieser Schritt Entwicklerwerkzeuge (so
      gekennzeichnet):

- [ ] TC-0680 Sicherung ziehen (Settings -> Daten -> Sicherung erstellen), damit der
      Ausgangszustand wiederherstellbar ist.
- [ ] TC-0681 Japanisch A1, Lektion "01-begruessungen", die Zuordnungs-Übung
      (ex-match-begruessung) einmal lernen und bei "こんにちは" absichtlich falsch
      antworten -> es entsteht eine Wiederholungskarte auf dem NEUEN Key
      "こんにちは (konnichiwa)".
- [ ] TC-0682 [Entwicklerwerkzeuge] Den Key dieser Karte auf die alte Form
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
- [ ] TC-0683 Dashboard neu laden -> der Hinweis erscheint (1 betroffene Karte,
      Japanisch A1).

Weg zurück (Test wiederholbar, keine Spuren):

- [ ] TC-0684 Nach dem Test die in Schritt 1 gezogene Sicherung importieren
      (Settings -> Daten -> Import) -> exakter Ausgangszustand, keine Spuren.
- [ ] TC-0685 [Entwicklerwerkzeuge] Alternativ das UPDATE umkehren (Server) bzw. die
      Testzeile wieder auf den neuen Key setzen (Dexie).

Nicht abgedeckt: Wird der Zustand nur auf dem Desktop erzeugt und geprüft,
bleibt das Verhalten des Hinweises im iOS-Standalone-Modus UNBELEGT (die
Herstellung ist dort ohne Mac-Web-Inspector nicht möglich). Das ist ein
zulässiges Ergebnis, aber ausdrücklich als offen zu vermerken, nicht
stillschweigend mit dem Desktop-Ergebnis gleichzusetzen.

### Download-Sichtbarkeit (Dexie-Modus, #1709 / #1719 / #1731)
- [ ] TC-0686 Gelöschtes Set bleibt gelöscht: Set in Meine Inhalte löschen →
      Aktualisieren → Set kommt NICHT zurück (#1719)
- [ ] TC-0687 Set aus einer nicht mehr konfigurierten Quelle bleibt in Meine
      Inhalte sichtbar (nicht still versteckt) (#1731/#1734)
- [ ] TC-0688 Buch-Empfehlungen kommen aus der foederierten Registry, nicht aus
      der entfernten offiziellen `books.yaml` (#1717)

### Einzelne Lektion löschen (#2064)

Ort: Meine Inhalte (`/content?tab=my`) → Meine Lektionen → ein Set mit
MEHREREN Lektionen (z. B. nach einem Buch-Import) → "Lektionen verwalten".

- [ ] TC-0689 Vorbereitung: Buch importieren/erzeugen (mehrere Lektionen in einem
      Set) ODER ein mehrlektioniges eigenes Set; 1-2 Lektionen spielen
      (Fortschritt + Wiederholungskarten erzeugen)
- [ ] TC-0690 "Lektionen verwalten" klappt die Einzel-Lektionsliste auf; jede
      Lektion hat Abspielen + Löschen
- [ ] TC-0691 Löschen öffnet einen Bestätigungsdialog, der die Lektion benennt
      und sagt, dass es NICHT rueckgaengig gemacht werden kann
- [ ] TC-0692 Häkchen "Auch meinen Lernfortschritt löschen" zeigt die ECHTE
      Karten-Anzahl der Lektion (nicht rueckgaengig)
- [ ] TC-0693 Löschen OHNE Häkchen: Lektion verschwindet aus der Liste,
      lesson_count sinkt, Geschwister-Lektionen bleiben unverändert;
      Fortschritt der gelöschten Lektion bleibt (verwaist, später
      aufraeumbar)
- [ ] TC-0694 Löschen MIT Häkchen: Fortschritt + Wiederholungskarten NUR dieser
      Lektion sind weg, Geschwister-Fortschritt bleibt
- [ ] TC-0695 Keine Umnummerierung: die verbleibenden Lektionen behalten ihre
      Titel/Reihenfolge, Deep-Links auf sie funktionieren weiter
- [ ] TC-0696 Letzte Lektion eines Sets löschen entfernt das GANZE Set aus Meine
      Inhalte
- [ ] TC-0697 Dialog per Tastatur bedienbar: Löschen-Button ist fokussiert,
      Escape/Abbrechen schliesst
- [ ] TC-0698 BEIDE Modi prüfen: Desktop/Server (API) UND GitHub Pages (Dexie)
- [ ] TC-0699 Backup-Zeitpunkt: VOR dem Löschen ein Backup (.alb) erstellen →
      Lektion löschen → Backup importieren → die Lektion ist wieder da
      (korrekt: ein Backup ist eine Momentaufnahme, KEIN Bug)

### Mehrere Lektionen auf einmal löschen (#2065)

Ort: Meine Inhalte (`/content?tab=my`) → Meine Lektionen → ein Set mit
MEHREREN Lektionen → "Lektionen verwalten".

- [ ] TC-0700 Vorbereitung: mehrlektioniges eigenes Set (z. B. Buch-Import);
      bei 2-3 Lektionen Fortschritt + Wiederholungskarten erzeugen
- [ ] TC-0701 "Lektionen auswählen" schaltet einen Auswahlmodus ein: je Zeile
      erscheint ein Kontrollkaestchen, die Zeilenaktionen (Verschieben,
      Abspielen, Bearbeiten, Löschen) sind in diesem Modus ausgeblendet
- [ ] TC-0702 "Alle auswählen" setzt alle Häkchen, nochmal geklickt hebt sie
      auf; "N ausgewählt" zählt korrekt mit
- [ ] TC-0703 "N löschen" ist deaktiviert, solange nichts ausgewählt ist
- [ ] TC-0704 Löschen öffnet EINEN Bestätigungsdialog, der die ANZAHL benennt
      und sagt, dass es NICHT rueckgaengig gemacht werden kann; der Dialog
      empfiehlt sichtbar (ohne Zwang) vorher ein Backup
- [ ] TC-0705 Häkchen "Auch meinen Lernfortschritt löschen" zeigt die
      AGGREGIERTE ECHTE Karten-Anzahl über alle ausgewählten Lektionen
- [ ] TC-0706 Löschen OHNE Häkchen: genau die ausgewählten Lektionen
      verschwinden in EINEM Schritt, lesson_count sinkt entsprechend,
      NICHT ausgewählte Geschwister-Lektionen bleiben unverändert
- [ ] TC-0707 Reihenfolge: die verbleibenden Lektionen behalten ihre Reihenfolge
      (keine Umnummerierung), Deep-Links auf sie funktionieren weiter
- [ ] TC-0708 Löschen MIT Häkchen: Fortschritt + Wiederholungskarten NUR der
      ausgewählten Lektionen sind weg, Geschwister-Fortschritt bleibt
- [ ] TC-0709 ALLE Lektionen auswählen und löschen: der Dialog sagt VORHER, dass
      das GANZE Set gelöscht wird; danach ist das Set aus Meine Inhalte weg
- [ ] TC-0710 Dialog per Tastatur bedienbar: Löschen-Button ist fokussiert,
      Escape/Abbrechen schliesst; Kontrollkaestchen haben ein aria-label
- [ ] TC-0711 BEIDE Modi prüfen: Desktop/Server (API) UND GitHub Pages (Dexie)
- [ ] TC-0712 Backup-Zeitpunkt: VOR dem Löschen ein Backup (.alb) erstellen →
      mehrere Lektionen löschen → Backup importieren → die Lektionen sind
      wieder da (korrekt: ein Backup ist eine Momentaufnahme, KEIN Bug)
- [ ] TC-0713 iOS-Standalone (zum Homescreen hinzugefuegte PWA, Dexie-Modus):
      Auswahlmodus, Kontrollkaestchen und der Bestätigungsdialog sind mit
      dem Finger bedienbar; die Aktionsleiste bricht auf schmalem Display
      sauber um (kein Ueberlauf)

### Content-Repo trennen vs. Fortschritt löschen (#1651 / #1652)

Ort: Settings → Daten → Content-Repo-Liste → "Entfernen".

- [ ] TC-0714 Standard (Häkchen NICHT gesetzt): beruhigender Hinweis, dass der
      Lernfortschritt ERHALTEN bleibt und beim Wiederverbinden zurück-
      kommt
- [ ] TC-0715 "Fortschritt löschen"-Häkchen gesetzt: Warnung mit ECHTEN Zahlen
      (N Lektionen + M Wiederholungskarten, nicht rueckgaengig)
- [ ] TC-0716 Nur trennen → dasselbe Repo wieder verbinden → Fortschritt wieder da
- [ ] TC-0717 Trennen + löschen → wieder verbinden → Fortschritt leer
- [ ] TC-0718 Häkchen erscheint nur wenn es Fortschritt zu löschen gibt
      (Dexie-Modus)

### Empfohlene Repositories: Buttons pro Zeile (#2558)

Ort: Settings → Daten → Empfohlene Repositories.

- [ ] TC-0719 Mehrere Empfehlungen sichtbar → "Repository hinzufügen" bei EINER
      klicken → NUR dieser Button wird deaktiviert, die anderen bleiben
      klickbar
- [ ] TC-0720 Während des Hinzufügens erscheint ein Fortschrittsanzeige (Label +
      Balken sobald die Sync-Phase Zahlen liefert) direkt bei der
      geklickten Zeile, nicht global
- [ ] TC-0721 Zweite Empfehlung während des Ladens der ersten klicken → beide
      laufen unabhängig durch, keine Fehlermeldung
- [ ] TC-0722 Nach Abschluss: Zeile verschwindet aus "Empfohlen" (jetzt in
      "Meine Content-Repositories"), Button-Zustand der übrigen Zeilen
      unverändert

### Social Sharing (visuell + nativ)
- [ ] TC-0723 Share-Button nach Lektion sichtbar
- [ ] TC-0724 Mobile: native Share-Sheet (WhatsApp/Telegram)
- [ ] TC-0725 Desktop: kopiert in Zwischenablage + Toast
- [ ] TC-0726 PNG Share-Card: sieht gut aus (1200x630, Theme-Tokens)

---

## PRIO 5: AI FEATURES (braucht echten API-Key)

- [ ] TC-0727 Provider-Tabelle: Key eingeben → "Testen" → "Verbindung ok"
- [ ] TC-0728 "Übungen generieren" bei theory-only: AI liefert Ergebnis
- [ ] TC-0729 Qualität der generierten Exercises: sinnvoll? Typenvielfalt?
- [ ] TC-0730 "Sitzung fortsetzen" nach Chat-Import: AI kennt den Kontext
- [ ] TC-0731 Tutor-Chat (assistant-ui, #1126): tippen → senden (oder Enter), die
      Antwort streamt herein; die 7-Schritt-Cycle-Progress rueckt vor;
      Vorlesen + Diktat funktionieren; das Fortsetzen einer regulaeren
      Sitzung zeigt den bisherigen Gespraechsverlauf
- [ ] TC-0732 Importierte Sitzung: die KI beginnt von selbst mit der ersten Frage
      (kein User-Turn zuerst), der Chat startet leer
- [ ] TC-0733 AI Content Validation: Report sinnvoll? Provider+Modell angezeigt?
- [ ] TC-0734 Kein Button ohne Key führt zu Error-Toast (disabled + Tooltip)

### Stapel-Generierung "Übungen für alle Lektionen" (#1896)
- [ ] TC-0735 Meine Inhalte → Meine Lektionen, Set in dem ALLE Lektionen bereits
      Übungen haben: Button "Übungen für alle Lektionen generieren" ist
      SOFORT deaktiviert, Tooltip "Alle Lektionen haben bereits Übungen."
      (kein Klick nötig, kein Info-Toast)
- [ ] TC-0736 Set mit mindestens EINER Lektion ohne Übungen: Button aktiv,
      Kosten-Bestätigung → Fortschritt → Ergebnis-Toast wie bisher
- [ ] TC-0737 Nach erfolgreichem Durchlauf (alle Lektionen fertig): Button wird
      ohne Reload deaktiviert

### "KI fragen"-Button in Lektionen (#2693)
- [ ] TC-0738 Standardmäßig sichtbar: unter jedem Theorie-Block und jeder Übung
      erscheint der "KI fragen"-Button, auch ohne AI-Key (dann ausgegraut
      mit BYOK-Hinweis-Popover statt versteckt)
- [ ] TC-0739 Einstellungen → Lernen → Interaktion → "'KI fragen'-Button
      anzeigen" ausschalten: der Button verschwindet in der laufenden
      Lektion (Theorie und Übungen), ohne Reload
- [ ] TC-0740 Toggle wieder einschalten: Button erscheint sofort wieder
- [ ] TC-0741 Der Toggle-Zustand bleibt nach einem Reload erhalten (localStorage)

### KI-Schlüssel-Tresor Import (#1765 / #1769)
- [ ] TC-0742 Settings → KI → "Konfigurierte Provider" → "Importieren" springt zu
      Settings → Daten und scrollt den KeyVault-Import-Block sichtbar (#1765)
- [ ] TC-0743 Import per "Datei wählen" ODER Einfügen des rohen Envelope-JSON in
      das Textfeld; Passphrase immer erforderlich
- [ ] TC-0744 Kaputtes/unvollstaendiges JSON → Inline-Fehler (aria-live), Import
      bleibt deaktiviert
- [ ] TC-0745 Nach erfolgreichem Import (Datei ODER Einfügen): Wechsel zu
      Settings → KI zeigt den Key SOFORT, ohne Reload (#1769)
- [ ] TC-0746 Passphrase maskiert mit Reveal-Toggle; Key/Passphrase nie geloggt

### Cross-App-Tresor-Import (Topos → Adaptive Learner) (#2512)
- [ ] TC-0747 Eine in Topos exportierte .alk-Datei (Format "topos-ai-keys")
      importiert ohne "Fremd-Datei"-Ablehnung; die Passphrase der DATEI
      wird abgefragt
- [ ] TC-0748 Der Topos-Key unter "google" landet nach dem Import auf dem
      Provider "Gemini" (Settings → KI zeigt ihn dort)
- [ ] TC-0749 Falsche Passphrase → Warnung, kein Key wird geschrieben
- [ ] TC-0750 AL-Export unverändert: exportierte Datei trägt weiter das Format
      "adaptive-learner-keys"

### Perplexity-Provider (OpenAI-kompatibel, nur Server-Modus) (#2512)
- [ ] TC-0751 Settings → KI: "Perplexity" erscheint in der Provider-Auswahl
      (nach Gemini)
- [ ] TC-0752 Server-Modus (make dev): pplx--Key speichern, Modell-Picker zeigt
      die statische sonar-Liste (sonar, sonar-pro, sonar-reasoning)
- [ ] TC-0753 Server-Modus: Session-Nachricht mit aktivem Perplexity liefert
      eine Antwort (Modell sonar-pro als Default)
- [ ] TC-0754 Browser-Modus (Dexie/PWA): Perplexity ist sichtbar, aber als
      "nur Desktop" markiert (kein toter Menüpunkt, kein CORS-Fehler)

---

## PRIO 6: THEMES (subjektive Aesthetik)

Für JEDES Theme einmal durchklicken:
- [ ] TC-0755 Light: lesbar, Kontraste
- [ ] TC-0756 Dark: lesbar, App-Icon helle Variante
- [ ] TC-0757 Ocean, Forest, Sepia, High-Contrast
- [ ] TC-0758 Catppuccin Mocha, Soft Pop, Amethyst Haze
- [ ] TC-0759 Buttons kontrastreich auf ALLEN Themes?
- [ ] TC-0760 Dropdowns: opaker Hintergrund (nicht transparent)?
- [ ] TC-0761 Share-Card: Theme-Tokens korrekt?

---

## PRIO 7: GERAETE-SPEZIFISCH (nicht scriptbar)

### iPhone Safari
- [ ] TC-0762 "Zum Home-Bildschirm" → App-Icon korrekt
- [ ] TC-0763 PWA startet im Dexie-Modus
- [ ] TC-0764 Safe-Area Insets respektiert
- [ ] TC-0765 Mobile Nav = Hamburger-Drawer (Bottom Tab Bar wurde in #1512
      entfernt); Drawer-Links 44px, schliesst nach Navigation
- [ ] TC-0766 Tipp-Versatz auf dem iPhone (#1569, behoben mit #2984 + #3004,
      Ablesung 7 vom 2026-09-10): in einer Lektion ein Freitextfeld
      fokussieren, tippen, Tastatur schliessen, erneut ins Feld tippen,
      danach eine MC-Kachel tippen. Caret sitzt im Feld, jeder Tipp trifft
      das Element unter dem Finger. Bei Rückfall: Einstellungen >
      Diagnose & Support > "Tipp- und Viewport-Sonde" einschalten, den
      Fehltipp mit "Daneben!" markieren, "Werte kopieren" und das
      Protokoll ans wiedereröffnete Issue #1569.

#### Theorie-Vorlesen auf iOS: langer Text (#1928) - PFLICHT

iOS Safari bricht eine ungestueckelte Sprachausgabe nach ~15 Sekunden ab.
Seit #1928 wird ein Theorie-Block in Stücke zerlegt und als Warteschlange
gesprochen. Gemessen: 617 von 621 Theorie-Läufen liegen über der
Stueckgrenze, ein mittlerer Lauf hat 1551 Zeichen.

- [ ] TC-0767 Auf dem iPhone eine Lektion mit langem Theorie-Text öffnen,
      Vorlesen starten
- [ ] TC-0768 Der Text wird **vollständig** vorgelesen und bricht nicht nach
      ~15 Sekunden ab
- [ ] TC-0769 Beim mehrteiligen Theorie-Block schaltet die Lektion während des
      Vorlesens automatisch zum nächsten Schritt weiter (die Stueckelung
      darf die Position im Text nicht verfaelschen)
- [ ] TC-0770 Zwischen den Stuecken entsteht kein hoerbares Stocken
- [ ] TC-0771 Bekanntes Plattform-Limit, KEIN Fehler: Pause/Fortsetzen wirkt auf
      iOS Safari nicht (dort stoppt + startet die App neu)

#### Vorlesen läuft weiter, wenn der Bildschirm automatisch ausgeht (#2666) - PFLICHT

Der Screen Wake Lock hält den Bildschirm während des Vorlesens wach, damit
der Inaktivitäts-Timer des Geräts die Sprachausgabe nicht unterbricht
(iOS Safari + mobile Chrome-Browser stoppen `speechSynthesis`, sobald der
Bildschirm automatisch ausgeht).

- [ ] TC-0772 Auf dem iPhone (Safari) eine Lektion öffnen, Vorlesen starten und
      das Gerät NICHT berühren
- [ ] TC-0773 Bis kurz vor den normalen Sperr-Timeout des Geräts warten (Handy
      liegen lassen): der Bildschirm bleibt an, solange vorgelesen wird
- [ ] TC-0774 Das Vorlesen läuft ununterbrochen bis zum Ende des Textes weiter
- [ ] TC-0775 Nach "Stop" bzw. Ende des Vorlesens darf der Bildschirm wieder
      normal automatisch ausgehen (Wake Lock wird freigegeben)
- [ ] TC-0776 Gleicher Ablauf auf einem Android-Gerät (Chrome)
- [ ] TC-0777 Bekanntes Plattform-Limit, KEIN Fehler: ein manuelles Drücken des
      Sperr-/Power-Buttons schaltet den Bildschirm trotzdem sofort aus und
      stoppt die Wiedergabe - das kann keine Web-API verhindern

#### App-Update als installierte iOS-PWA (#1357 / #1873) - PFLICHT

Der einzige Pfad, den kein Test abdeckt: auf iOS/WKWebView aktiviert
ein neuer Service Worker sich oft NICHT durch skipWaiting + Reload,
sondern erst nach vollstaendigem Schliessen und Neuoeffnen der App.

- [ ] TC-0778 PWA auf dem Home-Bildschirm installieren, Build-Hash unter
      Einstellungen > Über notieren
- [ ] TC-0779 Neuen Build deployen, App aus dem Hintergrund zurueckholen
      (nicht neu starten): Update-Banner erscheint
- [ ] TC-0780 Banner zeigt ZUSAETZLICH den Hinweis "Schliesse die App und
      oeffne sie neu" - dieser Hinweis darf auf iOS-Standalone nie
      fehlen
- [ ] TC-0781 "Aktualisieren" tippen: Banner verschwindet und kommt auch nach
      Reload NICHT wieder (Accept-Unterdrueckung)
- [ ] TC-0782 App vollständig schliessen und neu öffnen: Build-Hash unter
      Über ist der neue
- [ ] TC-0783 Auf einem NICHT-iOS-Gerät (Android/Desktop) denselben Ablauf:
      der Neustart-Hinweis darf dort NICHT erscheinen

#### "Was ist neu"-Hinweisfenster bleibt schließbar (#2266)

Das "Was ist neu"-Fenster des Update-Banners im Desktop-/API-Modus
(`DesktopUpdateHost`) darf die Nutzerin nie einsperren, egal wie hoch die
Release- und Installationshinweise sind. Die Sichthöhe ist bei einem
kurzen Fenster am kritischsten, deshalb die iOS-Standalone- bzw.
Hochformat-Situation ausdrücklich prüfen.

- [ ] TC-0784 Im API-/Desktop-Modus mit verfügbarem Update im Banner "Was ist
      neu?" öffnen - das Fenster erscheint mit Titel, scrollbarem Inhalt
      und einem stets sichtbaren X in der Kopfzeile
- [ ] TC-0785 Lange Hinweise: der Inhalt scrollt; das X in der Kopfzeile und der
      "Schließen"-Knopf in der Fußzeile bleiben erreichbar (die Hinweise
      schieben die Aktionen nie aus dem Bild)
- [ ] TC-0786 Auf vier Wegen schließen, jeder wirkt: das X in der Kopfzeile, der
      "Schließen"-Knopf, die Escape-Taste und ein Klick auf den
      Hintergrund außerhalb der Karte
- [ ] TC-0787 Ein Klick INNERHALB der Karte schließt sie NICHT
- [ ] TC-0788 Kurzes Fenster / iOS-Standalone: das Fenster auf Hochformat-Höhe
      verkleinern (oder eine installierte iOS-Standalone-Ansicht) - das X
      bleibt fest in der Kopfzeile, während die Hinweise scrollen; das
      Fenster ist weiter über X, Escape und einen Hintergrund-Tipp
      schließbar. Mit eingeblendeter Bildschirmtastatur wiederholen
- [ ] TC-0789 Tastatur/Screenreader: der Fokus wandert beim Öffnen in das
      Fenster, Tab bleibt darin, und der Fokus kehrt beim Schließen zum
      "Was ist neu?"-Knopf zurück (keine Axe-Regression)

### Android Chrome
- [ ] TC-0790 "App installieren" → Maskable Icon nicht abgeschnitten
- [ ] TC-0791 PWA funktioniert, Dexie-Modus

### Desktop PWA
- [ ] TC-0792 Install-Prompt → App startet standalone
- [ ] TC-0793 Dexie-Modus (NICHT API-Modus, keine 404)

---

## PRIO 8: SERVER-MODUS (via Launcher)

- [ ] TC-0794 Set herunterladen → in "Meine Inhalte" sichtbar (kein Cache-Problem)
- [ ] TC-0795 Backup-Import: kein HTTP 413
- [ ] TC-0796 Lektion durchspielen: keine workbox Fehler in der Konsole
- [ ] TC-0797 Port wechseln → App erreichbar auf neuem Port

---

## PRIO 9: LANDESEITE (statisch, #2409)

Die Landeseite unter `/start/` (DE) und `/start/en/` (EN) ist echtes
statisches HTML im Pages-Artefakt - kein React, kein Nachladen. Sie trägt
bewusst keine Zahlen, die veralten könnten.

- [ ] TC-0798 `astrapi69.github.io/adaptive-learner/start/` laedt; Kernsatz "Eine
      App, die sich dir anpasst, nicht umgekehrt." als Ueberschrift sichtbar.
- [ ] TC-0799 "App im Browser öffnen" führt zur App; "Launcher herunterladen"
      führt zur Release-Seite.
- [ ] TC-0800 Sprachwechsel: "English" oben rechts führt auf `/start/en/`, dort
      führt "Deutsch" zurück.
- [ ] TC-0801 Verweise unten (Dokumentation, Repository, Lerninhalte) funktionieren.
- [ ] TC-0802 Fußzeile (#3113): "Impressum" führt auf `astrapi69.github.io/adaptive-learner/docs/legal/imprint/`,
      "Datenschutz" auf `astrapi69.github.io/adaptive-learner/docs/legal/privacy/`; auf `/start/en/` heißen sie
      "Legal notice" / "Privacy policy" und führen auf `astrapi69.github.io/adaptive-learner/docs/en/legal/…`.
- [ ] TC-0803 Dunkles System-Theme: Seite folgt (prefers-color-scheme), Text lesbar.
- [ ] TC-0804 Mobil (schmales Fenster): einspaltig, kein horizontales Scrollen.

### Rechtstexte in der App erreichbar (#3113)

Impressum und Datenschutzerklärung liegen als Hilfeseiten auf der Docs-Site
(`astrapi69.github.io/adaptive-learner/docs/legal/imprint/`, `astrapi69.github.io/adaptive-learner/docs/legal/privacy/`; andere Sprachen unter
`astrapi69.github.io/adaptive-learner/docs/<lang>/legal/…`, Locales ohne eigene Fassung fallen auf Deutsch zurück).

- [ ] TC-0805 App-Startseite `/` (ohne angemeldeten Lernenden): unter "Dokumentation
      lesen" stehen "Impressum · Datenschutzerklärung"
      (`landing-imprint-link`, `landing-privacy-link`); beide öffnen die
      Docs-Seite in einem neuen Tab, in der aktiven UI-Sprache (Deutsch ohne
      Präfix, Englisch unter `astrapi69.github.io/adaptive-learner/docs/en/`).
- [ ] TC-0806 Einstellungen → Über → Karte "Lizenz & Ressourcen": zwei neue Zeilen
      "Impressum" und "Datenschutzerklärung" (`about-imprint-link`,
      `about-privacy-link`), gleiche Ziele, neuer Tab.
- [ ] TC-0807 Hilfepanel und Docs-Site: Abschnitt "Rechtliches" mit beiden Seiten in
      der Navigation (DE + EN); das Impressum nennt Name, Anschrift, E-Mail;
      die Datenschutzerklärung trägt ein Datum und nennt GitHub Pages,
      YouTube-Vorschaubilder und die KI-Anbieter mit eigenem Schlüssel.
- [ ] TC-0808 Teilen-Vorschau (z. B. in einem Messenger): Titel, Beschreibung und
      Bild erscheinen (Open-Graph-Daten der Landeseite, nicht der App).

---

## PRIO 10: Selektiver Datenexport - Sprachaufnahmen-Kategorie (#2840)

Ort: Einstellungen > Daten > "Ausgewählte Daten exportieren".

- [ ] TC-0809 Gruppe "Medien" mit Kategorie "Sprachaufnahmen" ist sichtbar,
      standardmäßig NICHT angehakt (im Gegensatz zu Lernprojekte/
      Curricula/Fortschritt/Fächer, die vorausgewählt sind)
- [ ] TC-0810 Ohne Anhaken: exportierte Datei enthält KEINE
      `speech_recordings`-Zeilen, auch wenn welche vorhanden sind
- [ ] TC-0811 Anhaken + Export: die Datei enthält die `speech_recordings`-Zeilen
      des Nutzers

## PRIO 11: Preset-Avatar-Galerie (#2848)

Ort: Einstellungen > Allgemein > Profil, unter dem Foto-Upload.

- [ ] TC-0812 Zeile "Oder wähle eine Figur" mit 8 Figuren sichtbar (Funke,
      Roboter, Stern, Katze, Eule, Geist, Blitz, Herz), jede mit
      sprechendem Tooltip/Screenreader-Namen
- [ ] TC-0813 Figur antippen: Erfolgs-Toast, Vorschau oben und der Avatar in der
      Kopfleiste zeigen die Figur sofort (ohne Reload)
- [ ] TC-0814 Gewählte Figur ist markiert (Rahmen); eine andere wählen
      verschiebt die Markierung
- [ ] TC-0815 Foto hochladen ersetzt die Figur; danach ist KEINE Figur mehr
      markiert; Figur wählen über einem Foto fragt erst nach (siehe
      Foto-Zwischenspeicher unten)
- [ ] TC-0816 "Entfernen" löscht den Avatar; die Kopfleiste fällt auf die
      Initialen zurück
- [ ] TC-0817 Backup-Round-trip: Figur wählen, Export (`.alb`), Daten löschen,
      Import → die Figur ist wieder gesetzt
- [ ] TC-0818 Beide Speicher-Modi (Server + Browser) verhalten sich identisch

#### Foto-Zwischenspeicher beim Figuren-Wechsel (#2862)

- [ ] TC-0819 Foto hochladen und zuschneiden, dann eine Figur antippen: ein
      Bestätigungsdialog erscheint ("Foto ersetzen?"); Abbrechen lässt
      Foto und Auswahl unverändert
- [ ] TC-0820 Bestätigen ("Figur verwenden"): die Figur ist aktiv und unter der
      Galerie erscheint der Knopf "Foto wiederherstellen"
- [ ] TC-0821 "Foto wiederherstellen": das Foto ist zurück (Vorschau +
      Kopfleiste), der Knopf verschwindet
- [ ] TC-0822 Figur-zu-Figur-Wechsel: KEIN Dialog (nur ein echtes Foto wird
      geschützt)
- [ ] TC-0823 Nach Figur-Wahl ein NEUES Foto hochladen: der alte Zwischenspeicher
      ist geleert (kein Wiederherstellen-Knopf mit veraltetem Foto)
- [ ] TC-0824 Backup-Round-trip: mit gefülltem Zwischenspeicher Export -> Wipe ->
      Import; "Foto wiederherstellen" funktioniert weiterhin (beide
      Speicher-Modi)

#### Avatar-Rahmen (#2850)

Ort: Einstellungen > Allgemein > Profil, unter der Figuren-Galerie.

- [ ] TC-0825 Zeile "Avatar-Rahmen" mit 7 Optionen (Ohne, Bronze, Silber, Gold,
      Flamme, Stern, Akzent); gesperrte zeigen ein Schloss und die
      Bedingung ("Ab Level 5", "Benötigt das 3-Tage-Serien-Abzeichen")
- [ ] TC-0826 Level-Freischaltung: mit ausreichendem Level ist der Rahmen wählbar;
      Auswahl legt den Ring sofort um die Vorschau UND den Avatar in der
      Kopfleiste (ohne Reload)
- [ ] TC-0827 XP-Kauf (Stern 150 / Akzent 300): Kauf-Knopf zeigt den Preis, erster
      Klick "Bestätigen", zweiter Klick zieht die XP ab (Kopfleisten-XP
      aktualisiert live), der Rahmen ist danach dauerhaft freigeschaltet
      und gewählt
- [ ] TC-0828 Zu wenig XP: der Kauf-Knopf ist deaktiviert, kein Abzug möglich
- [ ] TC-0829 Badge-Rahmen (Flamme): erst nach verdientem 3-Tage-Streak-Abzeichen
      wählbar
- [ ] TC-0830 Rahmen wirkt auf Foto-Avatare UND Preset-Figuren gleichermaßen;
      "Ohne" entfernt den Ring
- [ ] TC-0831 Backup-Round-trip: Rahmen wählen + einen kaufen, Export (`.alb`),
      Daten löschen, Import → Auswahl und Kauf sind wieder da
- [ ] TC-0832 Beide Speicher-Modi verhalten sich identisch (XP-Abzug inklusive)

### Wiederholung: nur Fehler, keine Endlosrunde (#3170)

- [ ] TC-0833 Eine Lektion OHNE Fehler durchspielen: der Lernpfad zeigt für das Set
      und die Lektion KEIN "Fehler trainieren (N)", der Kopfzeilen-Badge
      "N fällig" und die Dashboard-Karte "Fällig zur Wiederholung" zählen
      diese Elemente nicht mit; `/review/<set>` meldet "Alles erledigt"
- [ ] TC-0834 Eine Lektion mit einigen Fehlern durchspielen: "Fehler trainieren (N)"
      zählt genau die falsch beantworteten Elemente (N), nicht alle
      gespielten; nie-falsche Elemente erscheinen in der Wiederholungssitzung
      nicht
- [ ] TC-0835 Wiederholungssitzung mit mehr fälligen Elementen als "Fragen pro
      Wiederholung": Untertitel "{gezeigt} von {fällig} Element(en)"; nach
      der Runde "Noch N fällig. Weitermachen?" nennt GENAU die noch nicht
      gespielten Elemente; "Weitere Runde" zeigt nur diese; danach ist
      Schluss ("Alles erledigt"), kein "Weitere Runde" mehr, keine
      Endlosrunde
- [ ] TC-0836 Eine Zuordnungsübung, die mehrere fällige Elemente abdeckt (nur EINE
      Frage im Ablauf): der Untertitel zählt die abgedeckten ELEMENTE (also
      z. B. "3 Element(e)", nicht "1 von 3"), die Zusammenfassung "N von N
      korrigiert" rechnet auf derselben Basis, und nach der Runde bleibt
      nichts als "Noch N fällig" zurück
- [ ] TC-0837 Einstellungen > Lernen > Wiederholung: der neue Schalter "Auch
      fehlerfreie Elemente wiederholen" steht unter "Fragen pro Wiederholung",
      ist standardmäßig AUS und überlebt einen Reload
- [ ] TC-0838 Schalter EIN: nie-falsche Elemente kommen wieder nach 3 bzw. 7 Tagen in
      die Wiederholung (Badge, Dashboard-Karte, Sitzung). Enthält die Sitzung
      solche Elemente, sagt die Zusammenfassung "N von N gefestigt" mit der
      neutralen Trend-Zeile (kein "korrigiert", keine "Schwachstellen");
      "Fehler trainieren (N)" zählt weiterhin nur Fehler
- [ ] TC-0839 Lernpfad-Status: eine fehlerfrei gespielte Lektion gilt bei AUS als
      gemeistert (beide Richtungen, SRS-Status "gemeistert", nicht ewig
      "fällig"); bei EIN gilt wieder die Drei-in-Folge-Regel
- [ ] TC-0840 Beides im Browser-Modus (ohne Server) UND im Server-Modus prüfen

### Wiederholungssitzung auf der Runner-Hülle (EXP-052 Scheibe 1, #3169)

- [ ] TC-0841 `/review/<set>` mit fälligen Elementen öffnen: Kopf mit
      "Zurück zum Dashboard", Titel "Wiederholungssitzung" und dem
      Element-Untertitel; darunter der Fortschrittsbalken "Schritt 1 von N";
      der Fuß sieht aus wie in einer Lektion (Chevron-Pfeil "Zurück" links,
      "Prüfen" mit Haken rechts), keine Pause, keine Optionen-Leiste
- [ ] TC-0842 "Zurück" ist auf dem ersten Schritt deaktiviert; nach "Weiter" führt
      es einen Schritt zurück im selben Durchlauf (nicht zum Dashboard)
- [ ] TC-0843 Enter in einer Lückentext-Antwort: erster Enter prüft, zweiter Enter
      geht weiter; ohne Antwort tut Enter nichts; mit ausgeschaltetem
      Enter-Kürzel (Einstellungen > Lernen) tut Enter nichts
- [ ] TC-0844 Am Telefon nach "Weiter" (oder Enter): die Ansicht springt an den
      Anfang des neuen Schritts (Kopf schiebt sich weg, Balken und Aufgabe
      sind sichtbar, kein abgeschnittener Anfang); Gerät drehen: die Aufgabe
      und der Fuß liegen wieder im Sichtfeld
- [ ] TC-0845 Zurück auf einen bereits beantworteten Schritt: die Antwort ist
      gesperrt (Lösung sichtbar, keine Eingabe), der Fuß zeigt "Weiter" statt
      "Prüfen", Enter geht weiter statt zu prüfen; in Statistik / Fehler
      trainieren zählt das Element danach GENAU EINMAL für diese Runde (kein
      zweiter Versuch durch erneutes Beantworten)
- [ ] TC-0846 Zurück auf einen NOCH NICHT beantworteten Schritt (z. B. nach einem
      Sprung nach vorn und wieder zurück): der Schritt bleibt beantwortbar,
      "Prüfen" ist da
- [ ] TC-0847 Hinweise aus einem früheren Durchlauf zählen nicht (#3196): in einer
      Lektion einen Tipp aufdecken, dann `/review/<set>` öffnen und dasselbe
      Element ohne Tipp beantworten: in der Statistik ist der Versuch NICHT
      als "mit Tipp" markiert; ein Tipp, der IN der Sitzung aufgedeckt wird,
      zählt weiterhin; "Weitere Runde" beginnt wieder ohne Tipp-Merker
- [ ] TC-0848 Zusammenfassung: unverändert (Auswertung, SRS-Hinweis, "Weitere
      Runde" bei Rest, Wiederkomm-Zeile); der Fuß zeigt dort nur "Zurück"
      (Rückblick auf den letzten, gesperrten Schritt)
- [ ] TC-0849 Ladezustand, "Alles erledigt", "Set nicht heruntergeladen" und Fehler
      zeigen dieselben Bildschirme wie zuvor (Zurück zum Dashboard bzw.
      Inhaltsbrowser öffnen)
- [ ] TC-0850 Beides im Browser-Modus (ohne Server) UND im Server-Modus prüfen

### Zufallsmodus auf der Runner-Hülle (EXP-052 Scheibe 2, #3169)

- [ ] TC-0851 `/shuffle-lesson/<set>` für ein heruntergeladenes Set mit mindestens
      zwei Lektionen öffnen: Kopf mit "Zurück zum Dashboard", Titel und
      Untertitel "N Fragen aus M Lektionen gemischt"; darunter der
      Fortschrittsbalken "Schritt 1 von N"; der Fuß sieht aus wie in einer
      Lektion (Chevron-Pfeil "Zurück" links, "Prüfen" mit Haken rechts),
      keine Pause, keine Optionen-Leiste
- [ ] TC-0852 NEU: "Zurück" ist auf dem ersten Schritt deaktiviert; nach "Weiter"
      führt es einen Schritt zurück im selben Durchlauf
- [ ] TC-0853 NEU: Zurück auf einen bereits beantworteten Schritt: die Antwort ist
      gesperrt (Lösung sichtbar, keine Eingabe), der Fuß zeigt "Weiter"
      statt "Prüfen", Enter geht weiter; in Statistik / Fehler trainieren
      zählt das Element danach GENAU EINMAL für diese Runde (erneutes
      Beantworten zeichnet keinen zweiten Versuch mehr auf, anders als
      bisher)
- [ ] TC-0854 Zurück auf einen NOCH NICHT beantworteten Schritt: bleibt
      beantwortbar, "Prüfen" ist da
- [ ] TC-0855 Enter: erster Enter prüft eine beantwortete Aufgabe, zweiter Enter
      geht weiter; ohne Antwort tut Enter nichts; mit ausgeschaltetem
      Enter-Kürzel (Einstellungen > Lernen) tut Enter nichts
- [ ] TC-0856 NEU, am Telefon: nach "Weiter" (oder Enter) springt die Ansicht an
      den Anfang des neuen Schritts; Gerät drehen: Aufgabe und Fuß liegen
      wieder im Sichtfeld
- [ ] TC-0857 Hinweise aus einem früheren Durchlauf zählen nicht (#3196): in einer
      Lektion einen Tipp aufdecken, dann den Zufallsmodus desselben Sets
      öffnen und das Element ohne Tipp beantworten: in der Statistik NICHT
      als "mit Tipp" markiert; ein Tipp IN der Sitzung zählt; "Nochmal
      mischen" beginnt wieder ohne Tipp-Merker und ohne gesperrte Schritte
- [ ] TC-0858 NEU: Erweiterungsaufgaben (z. B. Sprechen und Aufnehmen,
      Kategorisieren, Fehler korrigieren, Leseverständnis, Bewertetes Quiz)
      und Multiple Choice aus dem Set werden mitgemischt und mit "Prüfen"
      gespielt (bisher nur die Kernaufgaben)
- [ ] TC-0859 Zusammenfassung unverändert: Punktzahl mit Prozent, "aus M
      verschiedenen Lektionen", "Nochmal mischen", "Zurück zum Dashboard";
      der Fuß zeigt dort nur "Zurück"
- [ ] TC-0860 Ladezustand, "zu wenige Lektionen", "Set nicht heruntergeladen" und
      Fehler zeigen die gewohnten Bildschirme
- [ ] TC-0861 Beides im Browser-Modus (ohne Server) UND im Server-Modus prüfen

### Endlosmodus auf der Runner-Hülle (EXP-052 Scheibe 2, #3169)

- [ ] TC-0862 `/endless-lesson/<set>` für ein heruntergeladenes Set öffnen: Kopf
      mit "Zurück zum Dashboard" und Titel "Endlos-Übung"; darunter die
      Statuszeile "m:ss | N Karten | K richtig (P%)"; die Uhr läuft
- [ ] TC-0863 NEU: die Statuszeile ist reine Anzeige (keine Knöpfe mehr darin);
      "Pause" und "Beenden" sitzen im Fuß links, "Prüfen" mit Haken rechts;
      es gibt KEIN "Zurück" (ein Strom hat keinen vorigen Schritt)
- [ ] TC-0864 NEU: "Pause" im Fuß: die Aufgabe verschwindet hinter "Pausiert - mach
      eine kurze Pause.", die Uhr steht, "Prüfen" ist weg, Enter tut
      nichts; derselbe Knopf (jetzt "Fortsetzen") setzt fort, eine halb
      eingegebene Antwort ist noch da, die Uhr läuft weiter
- [ ] TC-0865 "Beenden" (auch während der Pause) zeigt die Auswertung: Dauer,
      Karten, Richtig mit Prozent, erledigte Wiederholungen, neu gelernt,
      geübte Fehler, Übungs-XP; der einzige Knopf "Zurück zum Dashboard" hat
      den Fokus, Enter führt zum Dashboard; auf der Auswertung gibt es
      keinen Fuß
- [ ] TC-0866 Enter: erster Enter prüft, zweiter Enter holt die nächste Karte; ohne
      Antwort tut Enter nichts
- [ ] TC-0867 NEU, am Telefon: nach "Weiter" springt die Ansicht an den Anfang der
      neuen Karte; Gerät drehen: Karte und Fuß liegen wieder im Sichtfeld
- [ ] TC-0868 Kommt dieselbe Karte im Strom wieder, ist sie frisch beantwortbar
      (keine Sperre) und zählt als neuer Versuch
- [ ] TC-0869 Hinweise aus einem früheren Durchlauf zählen nicht (#3196): Tipp in
      einer Lektion aufdecken, dann den Endlosmodus öffnen und das Element
      ohne Tipp beantworten: in der Statistik NICHT als "mit Tipp" markiert
- [ ] TC-0870 NEU: Erweiterungsaufgaben und Multiple Choice aus dem Set kommen im
      Strom vor. Mit einem Set, das "Sprechen und Aufnehmen" enthält (z. B.
      adaptive-learner-content oder alc-dog-training): Karte erscheint, der
      Browser fragt nach dem Mikrofon, Aufnahme starten und stoppen,
      "Prüfen", dann "Weiter": der Strom läuft mit der nächsten Karte weiter
      (Visual Device Check auf einem echten Telefon)
- [ ] TC-0871 Ladezustand, "keine Aufgaben", "Set nicht heruntergeladen" und Fehler
      zeigen die gewohnten Bildschirme
- [ ] TC-0872 Beides im Browser-Modus (ohne Server) UND im Server-Modus prüfen

### Adaptive Lektion auf der Runner-Hülle (EXP-052 Scheibe 3, #3169)

- [ ] TC-0873 `/adaptive-lesson/<set>` für ein Set mit aktiven Fehlern öffnen: Kopf
      mit "Zurück zum Dashboard" und dem Titel der Lektion; direkt unter dem
      Titel der Transparenzblock ("Diese Lektion konzentriert sich auf: ..."
      und "Basierend auf N aktiven Fehler(n)"); darunter der
      Fortschrittsbalken "Schritt 1 von N"; der Fuß sieht aus wie in einer
      Lektion (Chevron-Pfeil "Zurück" links, bei einer Aufgabe "Prüfen" mit
      Haken rechts), keine Pause, keine Optionen-Leiste
- [ ] TC-0874 NEU (#3224): mit mindestens 3 aktiven Fehlern aus derselben Lektion
      beginnt die adaptive Lektion mit einer Theorieseite aus dieser
      Lektion: ihr Text mit Überschriften und Fettdruck, NICHT "Dieser
      Übung fehlt ein Übungstyp"; der Fuß zeigt nur "Weiter", kein
      "Prüfen"; "Weiter" (oder Enter) führt zur ersten Aufgabe, dort
      erscheint "Prüfen"
- [ ] TC-0875 "Zurück" ist auf dem ersten Schritt deaktiviert; nach "Weiter" führt
      es einen Schritt zurück im selben Durchlauf
- [ ] TC-0876 NEU: Enter (die adaptive Lektion hatte bisher kein Enter-Kürzel):
      erster Enter prüft eine beantwortete Aufgabe, zweiter Enter geht
      weiter; ohne Antwort tut Enter nichts; mit ausgeschaltetem
      Enter-Kürzel (Einstellungen > Lernen) tut Enter nichts
- [ ] TC-0877 NEU: Zurück auf einen bereits beantworteten Schritt: die Antwort ist
      gesperrt (Lösung sichtbar, keine Eingabe), der Fuß zeigt "Weiter"
      statt "Prüfen", Enter geht weiter; in Statistik / Fehler trainieren
      zählt das Element danach GENAU EINMAL für diese Runde (erneutes
      Beantworten zeichnet keinen zweiten Versuch mehr auf, anders als
      bisher)
- [ ] TC-0878 Zurück auf einen NOCH NICHT beantworteten Schritt: bleibt
      beantwortbar, "Prüfen" ist da
- [ ] TC-0879 NEU, am Telefon: nach "Weiter" (oder Enter) springt die Ansicht an
      den Anfang des neuen Schritts; Gerät drehen: Aufgabe und Fuß liegen
      wieder im Sichtfeld
- [ ] TC-0880 Hinweise aus einem früheren Durchlauf zählen nicht (#3196): in einer
      Lektion einen Tipp aufdecken, dann die adaptive Lektion desselben
      Sets öffnen und das Element ohne Tipp beantworten: in der Statistik
      NICHT als "mit Tipp" markiert; ein Tipp IN der Sitzung zählt
- [ ] TC-0881 Zusammenfassung unverändert: Punktzahl mit Prozent, die Zeile
      "Verbesserung: +N Element(e) in dieser Sitzung gemeistert!" wenn in
      der Sitzung Elemente gemeistert wurden, der SRS-Hinweis, "Zurück zum
      Dashboard", darunter "Als Offline-Lektion speichern"; der Fuß zeigt
      dort nur "Zurück"
- [ ] TC-0882 Ladezustand ("Deine Fehler werden analysiert..."), "Noch nichts zum
      Anpassen" und "Set nicht heruntergeladen" zeigen die gewohnten
      Bildschirme; NEU: der Fehlerbildschirm ist der gemeinsame der Hülle
      (freundlicher Hinweis, den Rohfehler nur im Entwicklermodus, Knopf
      "Inhalts-Browser öffnen" statt "Zurück zum Dashboard")
- [ ] TC-0883 Beides im Browser-Modus (ohne Server) UND im Server-Modus prüfen

### Fehler wiederholen auf der Runner-Hülle (EXP-052 Scheibe 3, #3169)

- [ ] TC-0884 Eine Lektion mit mindestens zwei Fehlern beenden, in der
      Zusammenfassung "Fehler wiederholen" öffnen: Kopf mit "Zurück zur
      Lektion" und dem Titel "Fehler wiederholen: <Lektion>"; darunter der
      Fortschrittsbalken "Schritt 1 von N" (N = Zahl der falschen
      Aufgaben); der Fuß sieht aus wie in einer Lektion (Chevron-Pfeil
      "Zurück" links, "Prüfen" mit Haken rechts), keine Pause
- [ ] TC-0885 NEU: "Zurück" im Fuß (bisher gab es hier keins). Auf dem ersten
      Schritt deaktiviert; nach "Weiter" führt es einen Schritt zurück im
      selben Durchlauf, als reiner Rückblick
- [ ] TC-0886 NEU: Zurück auf einen bereits beantworteten Schritt: die Antwort ist
      gesperrt (Lösung sichtbar, keine Eingabe), der Fuß zeigt "Weiter"
      statt "Prüfen", Enter geht weiter; in Statistik / Fehler trainieren
      zählt das Element GENAU EINMAL für diese Runde (kein zweiter Versuch
      durch erneutes Beantworten)
- [ ] TC-0887 Zurück, BEVOR der aktuelle Schritt beantwortet ist, und wieder vor:
      dieser Schritt bleibt beantwortbar, "Prüfen" ist da
- [ ] TC-0888 Enter: erster Enter prüft eine beantwortete Aufgabe, zweiter Enter
      geht weiter; ohne Antwort tut Enter nichts
- [ ] TC-0889 NEU, am Telefon: nach "Weiter" (oder Enter) springt die Ansicht an
      den Anfang des neuen Schritts; Gerät drehen: Aufgabe und Fuß liegen
      wieder im Sichtfeld; ein sehr langes Wort im Lektionstitel bricht um,
      statt die Seite seitlich zu verbreitern (#2761)
- [ ] TC-0890 Hinweise aus einem früheren Durchlauf zählen nicht (#3196): einen in
      der Lektion aufgedeckten Tipp stempelt die Wiederholung NICHT als
      "mit Tipp"; ein Tipp, der in Runde eins aufgedeckt wird, zählt auch
      in der nächsten Runde ("Nochmal?") noch
- [ ] TC-0891 Zusammenfassung: "X/Y jetzt richtig!"; alle richtig: "Alle Fehler
      korrigiert!" mit Konfetti, "Zurück zur Lektion" hat den Fokus, Enter
      führt zur Lektion; noch Fehler: "Noch N Fehler. Nochmal?" und
      "Zurück zur Lektion"; NEU: der Fuß zeigt dort "Zurück"
      (Rückblick auf den letzten, gesperrten Schritt)
- [ ] TC-0892 "Nochmal?" spielt NUR die noch falschen Aufgaben, und die sind wieder
      beantwortbar (nicht gesperrt), "Zurück" ist auf deren erstem Schritt
      deaktiviert
- [ ] TC-0893 Blitzrunde (#2888): Titel "Blitzrunde: <Set>", der Countdown-Ring
      steht direkt unter dem Titel und läuft pro Aufgabe; nach "Prüfen" hält
      er an; auf einem über "Zurück" wieder geöffneten, beantworteten
      Schritt läuft er nicht; "Zurück zur Lektion" und das Ende der Runde
      führen zur Set-Übersicht; eine gewöhnliche Wiederholung zeigt keinen
      Ring
- [ ] TC-0894 NEU: die Seite direkt aufrufen (Adresse neu laden, ohne Aufgaben):
      Titel "Fehler wiederholen", "Nichts zu wiederholen - ...", Knopf
      "Zurück zum Dashboard" (bisher "Inhalts-Browser öffnen")
- [ ] TC-0895 Beides im Browser-Modus (ohne Server) UND im Server-Modus prüfen

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
