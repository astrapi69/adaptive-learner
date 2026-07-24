# Offene Punkte — Stand 2026-07-22

Diese Liste sammelt alles aus der Session, das nicht von einem Agenten erledigt werden kann, weil es ein echtes Gerät, eine redaktionelle Entscheidung, oder eine manuelle Ausführung braucht.

## 1. Launch-Readiness

- [ ] **#1087 — Manueller Testplan durchlaufen** (DE + EN, `docs/manual-tests/testplan-adaptive-learner.md` / `-en.md`). Das ist der eigentliche BACKUP-AKZEPTANZTEST-Launch-Gate, seit Sessionbeginn verschoben. Deckt einen Großteil der Punkte unten automatisch mit ab, wenn der Testplan Schritt für Schritt durchgespielt wird.

## 2. Geräteverifikation (angesammelt über die Session)

- [ ] **iOS-Standalone-Update-Verhalten** (`#1569`). Fix bereits auf `develop` (PR #1832), wartet ausschließlich auf einen echten iPhone-Standalone-Test: Update-Banner erscheint nach Rückkehr aus dem Hintergrund, trägt den Neustart-Hinweis, Hinweis erscheint auf Android/Desktop nicht.
- [ ] **Matching-"Fehler wiederholen"-Flow**. Nur die falschen Paare erscheinen (plus Auffüll-Distraktoren bei sehr wenigen Fehlern), Einstellung "ganzes Set wiederholen" zeigt tatsächlich alle Paare.
- [ ] **Diktat-Audio-Durchlauf, kompletter Weg**:
  - Getippter Pfad (`assets/audio/...`) + Transkription → Speichern → Abspielen.
  - Neuer Audio-Upload-Button → echte Datei hochladen → Speichern → Abspielen.
  - Zu große/falsch formatierte Datei → klare Fehlermeldung.
  - Diktat über den Haupt-Wizard-Picker (nicht nur den Extension-Wizard) anlegen und spielen.
- [ ] **MC-Editor-Segmented-Control** ("Eine Antwort" / "Mehrere Antworten"): Position oben im Editor, Default korrekt, Umschalten funktioniert, bestehende Übungen bleiben unverändert, **Themen-Kontrast** der zwei Segmente in allen Themes prüfen (das kann happy-dom nicht abdecken).
- [ ] **MC-Toggle-Scroll-Jump-Fix verifizieren**, sobald gemergt (Screenshot-Bug: Umschalten scrollte die Seite nach oben und zeigte nur die halbe Ansicht).
- [ ] **Landing-Page-i18n-Fix verifizieren**, sobald gemergt (roher Key `landing.intro`, "Read the documentation" auf Englisch trotz `de`-Locale).
- [ ] **Drei Launcher-Binaries tatsächlich starten** (Linux/macOS/Windows), Prüfsummen sind vorhanden, aber der eigentliche Start-Test steht noch aus.

## 3. Redaktionsarbeit (bewusst nicht automatisierbar)

- [ ] **`engine#80` — 68 gefälschte Gedankenstriche** in `learn-content-engine/docs/*.md` (außerhalb von `docs/blog/`) redaktionell bereinigen. Pro Fundstelle Komma/Doppelpunkt/Klammer statt Strich wählen, das ist bewusst keine mechanische Ersetzung (`ms-dashes` ist für Korpora gedacht, die Striche wollen, hier gilt jetzt die verschärfte `STYLE.md`-Regel: gar keine Striche in selbst-autorierter Doku).

## 4. Bereits dispatchte, noch nicht bestätigte Bugfixes (Screenshots dieser Session)

Diese laufen bei CCW, aber nach dem Merge lohnt ein kurzer eigener Blick, da sie aus deinen eigenen Screenshots stammen:

- [ ] "Teile dein tolles Ergebnis"-Button teilt tatsächlich die Zusammenfassung, nicht nur die App.
- [ ] Fehlerkorrektur-Ergebnisanzeige: Leerzeichen zwischen Wörtern korrekt (Root Cause könnte Content-Daten statt Code sein, dann wäre das ein Fund in einem Content-Repo, kein App-Fix).
- [ ] Enter-Taste auf der Haupt-Zusammenfassungsseite löst "Nächste Lektion"-Starten aus.
- [ ] "Optionen"-Button liegt in derselben Zeile wie die Fortschrittsanzeige.

## 5. Für die nächste dedizierte Feature-Session (kein Zeitdruck)

- **`#1716`** — Domain-Selektor in `MetadataStep`, Vorbild `shareWizardHelpers.ts` (`KNOWN_CONTENT_DOMAINS`, `LEVEL_NONE`, `isCefr`, `isIsoLang`) + `useShareWizard.ts`.
- **`#1927` Phase 2b** — DOCX-Parser (`jszip` + `w:outlineLvl` aus `styles.xml`, adaptiver Split, Fallback auf Gesamtdokument).
- **`#1918`** — Content-Backfill der sechs Locales (el/es/fr/ja/pt/tr) ohne Extension-Inhalte, grammatiksensible Portierung, ~950 Zeilen × 6, eigene Session.
- Screenshottete Unstyled-Cluster (Backup, Dashboard, Lesson-Summary, Content-Browser) — brauchen den Visual-Baseline-Handshake, den nur du in einer rendering-fähigen Session durchführen kannst.

---

*Diese Liste wird nicht automatisch aktuell gehalten — nach jedem abgehakten Punkt kurz Bescheid geben, damit ich den entsprechenden Thread als erledigt einordnen kann.*
