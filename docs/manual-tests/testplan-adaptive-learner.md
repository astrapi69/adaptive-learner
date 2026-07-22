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
- [ ] **Datei-Upload im Buchtext-Schritt (#1927):** Button "Aus Datei
      laden (EPUB, TXT, MD)" ueber dem Textfeld; EPUB waehlen →
      Kapitelliste erscheint (Titel aus dem Inhaltsverzeichnis) mit
      Vorschau + Zeichenzahl; "In Textfeld uebernehmen" fuellt das
      Textfeld (bei vorhandenem Text: Bestaetigungsdialog "Ersetzen");
      Markdown-Datei → Split an Ueberschriften; TXT ohne Ueberschriften
      → ein Abschnitt; kaputte/zu grosse Datei (> 20 MiB) → klare
      Fehlermeldung, kein Crash; Rechte-Hinweis erwaehnt Hochladen
- [ ] **Lektion bearbeiten (#1740):** Meine Inhalte → Karte einer EIGENEN
      Lektion → Stift/Bearbeiten → Wizard oeffnet vorausgefuellt; Review
      zeigt "Aenderungen speichern" (ueberschreibt dieselbe id, Fort-
      schritt bleibt) + "Als Kopie speichern"; Fremd-Repo-Lektionen
      zeigen KEIN Bearbeiten; Analyse-Lektionen fuehren zur Import-Seite
- [ ] **Einfache Lektion (ohne Extension) bleibt speicherbar (#1919):**
      eine Lektion per Auto-Generieren erstellen (nur die sechs CORE-Typen,
      keine Extension-Uebung), lokal speichern → ueber Bearbeiten erneut
      oeffnen → zum Review blaettern: der Check "Gueltige Lektionsstruktur"
      ist GRUEN und "Aenderungen speichern" funktioniert (zuvor scheiterte
      es mit "ext_payload must be object" im API-/Server-Modus)
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
- [ ] **Lektionen kombinieren (#1741):** Meine Inhalte → "Zu Set
      kombinieren"-Umschalter → Checkbox-Auswahl (nur eigene Sets) →
      "Kombinieren"-Dialog: Neues Set (Titel Pflicht) vs. zu bestehendem
      Set; Originale bleiben erhalten; gemischte Sprachen/Level → nicht-
      blockierende Warnung
- [ ] **Gleiche-Sprache-Hinweis (#1721/#1730):** Quelle == Ziel zeigt
      neutralen Hinweis, blockiert "Weiter" NICHT; Save wird aktiv sobald die
      Checkliste passt
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
      hinzufuegen" bietet fuenf Typen — **Kategorisierung**, **Fehlerkorrektur**,
      **Leseverstaendnis**, **Benotetes Quiz**, **Diktat**. Je Typ oeffnet der
      Inline-Editor mit den passenden Feldern; Speichern ist deaktiviert bis der
      shipped Validator erfuellt ist (Kategorisierung: ≥2 benannte Buckets mit
      Items; Fehlerkorrektur: ≥2 Woerter + markierter Fehler + Korrektur;
      Leseverstaendnis: Text + ≥1 vollstaendige Frage; Benotetes Quiz: ≥1 Frage
      mit positiven Punkten; Diktat: nicht-leerer Audio-Pfad + ≥1 akzeptierte
      Transkription). Leseverstaendnis + Benotetes Quiz: pro Frage Umschalten
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
- [ ] **Multiple-Choice Single/Multi-Umschalter (#1888):** Im MC-Inline-Editor
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

### Karten-Bild-Upload (#1763 / #1764)

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
- [ ] Skip-to-Content-Link beim Tabben von oben sichtbar (#1727, a11y)

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

### Download-Sichtbarkeit (Dexie-Modus, #1709 / #1719 / #1731)
- [ ] Geloeschtes Set bleibt geloescht: Set in Meine Inhalte loeschen →
      Aktualisieren → Set kommt NICHT zurueck (#1719)
- [ ] Set aus einer nicht mehr konfigurierten Quelle bleibt in Meine
      Inhalte sichtbar (nicht still versteckt) (#1731/#1734)
- [ ] Buch-Empfehlungen kommen aus der foederierten Registry, nicht aus
      der entfernten offiziellen `books.yaml` (#1717)

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

## Automatisiert: Dexie-Smoke E2E (Playwright TS, 31 Spec-Dateien)

Abdeckung:
- Vollstaendiger Lesson-Playthrough (alle Exercise-Typen)
- Content Hub Tabs (Entdecken, Meine Inhalte, Import)
- Dashboard Tabs
- Navigation (Desktop + Mobile)
- Settings
- Backup Round-Trip (programmatisch)
- Alle Routes erreichbar (kein 404)

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
