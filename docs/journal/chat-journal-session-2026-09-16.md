# Chat-Journal 2026-09-16: Daten-Tab-Bereichsleiste, Kopfzeile am Telefon

Lane: Branch `claude/github-issues-open-rig959`, Session
`session_01Je1yaLMBYvTakepPRfMRha`.

## 1. Einstellungen > Daten: Bereichsleiste mit Deep-Links (#3122)

- Original prompt: "Daten ist auch sehr lang in den Einstellungen. Bis man
  hier irgendwo hin scrollt, dauert es sehr lange. Dafür könnten wir das sehr
  ähnlich wie bei Einstellungen lernen machen."
- Optimized prompt: "Den Daten-Tab wie den Lernen-Tab (#2951/#2961) in
  beschriftete Bereiche mit Chip-Leiste, `?tab=data&section=<id>`-Deep-Link
  und Scroll-Spy gliedern; die Kartenreihenfolge (#1451, #2955) bleibt."
- Goal: Auf dem Telefon in einem Tipp zu Backup, Aufräumen oder
  Gefahrenzone kommen statt durch dreizehn Karten zu scrollen.
- Result: Sechs Bereiche (Quellen, Synchronisation, Offline-Inhalte, Sichern
  und Exportieren, Aufräumen, Gefahrenzone). Die Leisten-Mechanik aus
  `useLearningSections` ist in den generischen Hook `useTabSections` plus
  das gemeinsame `TabSectionDef` gewandert, beide Tabs laufen über denselben
  Code; `SettingsCluster` nimmt ein `anchorPrefix`, die Daten-Anker heissen
  `data-<id>`. Katalog-Vorlauf als eigener PR (#2578): elf Kataloge mit
  `settings.cluster_data_<id>` plus `_desc` und `settings.data_nav_aria`.
  Sieben neue Tests in `Settings.sections.test.tsx`, Unit-Tests für
  `data-sections.ts`, Testplan DE und EN, FeatureShot `data-subnav/settings`.
  Die drei `settings-data-*`-Baselines wurden gelöscht und vom Sync neu
  aufgenommen (Löschen-dann-Resync, #2719); der Sync brachte genau diese
  drei Bilder zurück, keine Fremd-Drift.
- Commit: 54f7d747 (i18n, PR #3127, gemergt), e81e7a06 (Code, PR #3129).

## 2. Kopfzeile am Telefon: Menü-Knopf und Logo gequetscht (#3123)

- Original prompt: "siehe ss. Oben links. Das Hamburger Menü ist irgendwie
  gequetscht oder zerquetscht auf iPhone 14 Pro Max getestet."
- Optimized prompt: "Die Kopfzeile so bauen, dass Menü-Knopf und Logo bei
  beliebig vielen Abzeichen ihre Breite behalten; die Abzeichen weichen
  (kompakt, umbrechend), nie der Menüzugang."
- Goal: Kein Strich statt Menü-Knopf, Logo sichtbar, nichts abgeschnitten.
- Result: Ursache war die Flex-Verteilung: Hamburger und Logo waren die
  einzigen schrumpfbaren Kinder neben nicht schrumpfbaren Abzeichen. Schon
  das bestehende 375-px-Motiv zeigte das Logo als Strich, nur fiel es nie
  auf. Fix: `shrink-0` auf Hamburger und Logo; die rechte Gruppe (fällig,
  Aktualisierungen, XP, Avatar, Theme) liegt in einem umbrechenden,
  schrumpfbaren `nav-status`-Container (`md:contents`, Desktop unverändert);
  die Zähl-Abzeichen zeigen unter `sm` nur die Zahl neben dem Symbol
  (`splitAroundCount` trennt das Wort vom Platzhalter, jede Wortstellung
  funktioniert), der volle Text bleibt in `aria-label` und Tooltip. Neuer
  Dexie-Spec `nav-header-fit.spec.ts` (375 und 430 px, echte Abzeichen über
  zurückdatierte SRS-Zeilen, misst Knopf-, Logo- und Kindbreiten), Motiv
  `dashboard-badges` und FeatureShot `nav-badges/dashboard`, damit der
  Zustand im Prüfsatz ist. Damit die Alltagszeile (Menü, Logo, Modus, XP,
  Avatar, Theme) bei 375 px einzeilig bleibt, gibt die Leiste unter `sm`
  Abstand und Seitenrand enger (space-2 / space-3) und die Abzeichen
  verlieren ihre Extra-Ränder; nachgemessen mit dem vorinstallierten
  Chromium: Menü 44 px, Logo 28 px, eine Zeile ohne Abzeichen, zwei
  rechtsbündige Zeilen mit Abzeichen. Kein CSS geändert, keine neuen
  i18n-Schlüssel. Baseline-Sync in zwei Runden: der erste lieferte nur
  das neue Motiv, die 21 bestehenden Mobile-Bilder blieben unter der
  2500-Pixel-Toleranz stehen (#3023), obwohl ihr Logo noch der Strich
  war; nach Löschen-dann-Resync (#2719) zeigt jedes eine Differenz nur
  im Kopfzeilenband (y 8 bis 56 px, 2058 bis 3285 Pixel je Motiv,
  keine Zeile darunter), also reine Kopfzeilen-Neuordnung ohne
  Fremd-Drift.
- Commit: siehe PR.

## 3. Lektionsende: ausführliche Auswertung wie am Set-Ende (#3124, Teil 1)

- Original prompt: "Die ausführliche Auswertung in einer Lektion macht
  lediglich den Dropdown alle Antworten ansehen auf ... eigentlich wollten
  wir eine ausführliche Auswertung der Lektion wie es am Ende des Lernsets
  gemacht wird ... Kompakte Auswertung wo ganz wenig, wo auf einem
  Bildschirm passt, auch auf einem Handy."
- Optimized prompt: "Den Set-Aggregator und den Set-Renderer auf eine
  Lektion anwenden und in der ausführlichen Ansicht als erstes zeigen; die
  kompakte Fassung als eigener Schritt verkleinern."
- Goal: Aus der Lektions-Auswertung dieselben Ableitungen ziehen können
  wie aus der Set-Auswertung (Kennzahlen, Aufgabentypen, Schwachstellen).
- Result: `buildLessonReview` (`lib/statistics/lesson-review.ts`) filtert
  die Zeilen auf die Lektion und delegiert an `buildSetReview`, eine
  Rechenlogik für beide Sichten. Der Renderer der Set-Seite ist als
  `ReviewReport` (`components/progress`) herausgezogen, mit Testid-Präfix,
  Überschriftenebene und schaltbarer Lektionsaufschlüsselung; `SetSummary`
  behält alle `set-summary-*`-Ids. `LessonReviewReport` rendert die
  Lektionsfassung direkt unter dem Knopf der ausführlichen Ansicht, mit
  "Fehler trainieren" in die Wiederholungs-Sitzung des Sets. Katalog-Vorlauf
  als eigener PR (Subtitle und erweiterter Tooltip in 11 Katalogen). Die
  kompakte Voreinstellung (weniger Abschnitte, ein Bildschirm) folgt als
  Teil 2, weil sie Voreinstellungs-Pins, Hilfetexte und die
  Lektions-Baselines in zwölf Themes berührt.
- Commit: siehe PR.

## 4. Korrekturrunde: richtige Antwort sprang ohne Ergebnis weiter (#3125)

- Original prompt: "Bei der Zusammenfassung Fehler verbessern. Wenn etwas
  richtig ist, dann geht das gleich zur nächsten und man weiss nicht ob das
  vielleicht ein Fehler oder richtig war das sollte der User erkennen."
- Optimized prompt: "Die Korrekturrunde nach dem Prüfen auf dem Ergebnis
  halten, mit demselben Weiter-Rhythmus wie in der Lektion (Erfolgsbalken,
  Auto-Weiter-Einstellung, Enter)."
- Goal: Jede Antwort in der Korrekturrunde hat einen sichtbaren
  Ergebniszustand, bevor es weitergeht.
- Result: `handleClozeComplete` in `CorrectionBlock` wechselte nach dem
  Speichern sofort den Index, der geprüfte Lückentext wurde entladen. Jetzt
  speichert das Prüfen nur und merkt sich das Ergebnis; `advance` (Weiter,
  Enter, Auto-Weiter) geht weiter. Richtig: `ExerciseSuccessAdvance` der
  Lektion (Badge, Weiter, Auto-Weiter nach derselben Einstellung und
  Verzögerung); falsch: Meine Antwort / Lösung bleiben, schlichter
  Weiter-Knopf, nie automatisch. Drei neue Tests (falsch hält und geht
  weiter, Auto-Weiter nur bei richtig und eingeschaltet, Enter in zwei
  Schritten), zwei bestehende angepasst. Keine neuen i18n-Schlüssel
  (`lesson.button.next`).
- Commit: siehe PR.

## 5. iPhone: nach "Weiter" halbleerer Bildschirm (#3126)

- Original prompt: "Auf iPhone nach einer langen Seite, wenn man auf weiter
  klickt, kommt der Bildschirm zur Hälfte wie auf dem Screenshot."
- Optimized prompt: "Die zwei konkurrierenden Scrolls beim Schrittwechsel
  (Reset auf #root in useLessonNavigation, weiches scrollIntoView in
  Lesson.tsx) zu einem geordneten Ablauf zusammenführen: erst hart
  zurücksetzen, dann nach dem Layout den Anker setzen (Muster #1422)."
- Goal: Nach jedem Schrittwechsel liegt der Anker oben und die Fusszeile
  unten, ohne Wischen.
- Result: Neuer Hook `useStepReanchor` (`hooks/lesson/interaction`):
  `#root.scrollTop = 0` plus `window.scrollTo` ohne Animation, dann hinter
  doppeltem `requestAnimationFrame` `scrollIntoView` auf den Schrittanker
  (smooth, ausser bei reduzierter Bewegung). Der Scroll-Effekt in
  `useLessonNavigation` ist entfernt, der #959-Effekt in `Lesson.tsx` durch
  den Hook ersetzt. Fünf Vitest-Pins (Reihenfolge Reset vor Anker, jeder
  Schrittwechsel, reduzierte Bewegung, Gate, headless), ein Dexie-Spec bei
  375 px, der nach "Weiter" Anker-Position, Offset-Grenze und
  Fusszeilen-Lage misst (Chromium reproduziert den iOS-Klemm-Fehler nicht,
  pinnt aber den Vertrag). Der iOS-Beweis bleibt der Testplan-Schritt am
  Gerät.
- Commit: siehe PR.

## 6. Lektionsende: kompakte Voreinstellung, ein Bildschirm (#3124, Teil 2)

- Original prompt: "weiter mit #3124" (nach Teil 1, Abschnitt 3).
- Optimized prompt: "Die Voreinstellung der Zusammenfassungs-Abschnitte auf
  die kompakte Fassung setzen, die am Telefon auf einen Bildschirm passt
  (Ergebnis, XP, Weiter-Knopf); die Höhe am echten Build messen, bevor
  entschieden wird, welche Abschnitte drin bleiben; gespeicherte Wahlen
  bestehender Nutzer unangetastet lassen."
- Goal: Punkt 1 der Erwartung in #3124: Standard ist die kompakte
  Ein-Bildschirm-Fassung, auch am Telefon.
- Result: Messung am Dexie-Build (Playwright, 375x667 / 390x844 / 430x932)
  mit dem im Issue vorgeschlagenen Satz (Ergebnis, XP, Korrekturrunde,
  Nächste Schritte): Seite 1925 px hoch bei 667 px Viewport, drei
  Bildschirme. Ergebnis plus XP enden bei 571 px und passen; der Block
  "Warum du diese verpasst hast" (417 px), die zugeklappte Korrekturrunde
  (180 px) und die Nächste-Schritte-Karten (427 px) nicht. Entscheidung
  entlang des Issue-Wortlauts ("Ergebnis, XP, drei Kennzahlen,
  Weiter-Knopf"): Voreinstellung nur `result` und `xp`; alle anderen
  Abschnitte aus, erreichbar über "Ausführliche Auswertung" (#3031) oder
  dauerhaft über Einstellungen > Lernen. Damit die kompakte Fassung den
  Erklärungsblock zurückhalten kann, ist er jetzt ein eigener Abschnitt
  `explanations` (Zeile "Warum du diese verpasst hast", Schlüssel
  `review.explain_heading` wiederverwendet, keine neuen Katalog-Schlüssel);
  der #599-Schalter "Erklärungen nach der Antwort" bleibt sein
  Hauptschalter. Die #1432-Nachbarschaft (Erklärungen direkt über der
  Korrekturrunde) bleibt als Standardreihenfolge und als Migrationsregel:
  ein gespeicherter Acht-Einträge-Stand erhält den neuen Abschnitt
  eingeschaltet direkt vor seinem `correction`-Eintrag. Kein stiller Reset:
  nur eine frische Installation (kein gespeicherter Schlüssel) bekommt den
  kompakten Satz; fehlende Einträge in gespeicherten Ständen füllen sich
  wie bisher mit EIN. Der Splice- und der Fallback-Pfad in
  `LessonSummary.tsx` sind weg (der Abschnitt läuft durch die normale
  Reihenfolgeschleife). Tests: `summarySectionsPref.test.ts` (kompakter
  Standard, Migration vor Korrektur, Anhängen ohne Anker, Garbage ->
  Standard), `SummarySectionsControl.test.tsx`,
  `LessonSummary.sections.test.tsx` (kompakter Standard rendert genau
  Ergebnis + XP plus den Weiter-Fallback), `LessonSummary.detailed.test.tsx`
  (die ausführliche Ansicht hebt alle zurückgehaltenen Abschnitte),
  `LessonSummary.explanations-position.test.tsx` (eigener Slot,
  Migration), `Lesson.test.tsx` (Favorit, Antworten, Nächste Schritte
  in den Tests eingeschaltet). Nightly-Specs `lesson-summary-favorite`
  und `session2-learning-flow` schalten den Abschnitt, den sie prüfen,
  per gespeicherter Konfiguration ein. Baselines `lesson-result-*` (12)
  und `lesson-summary-*` (3) gelöscht für die Neuaufnahme. Hilfe
  (Einstellungen, Lektionen, DE + EN) und Testplan (DE + EN, neuer
  Abschnitt plus zwei angepasste Schritte).
- Nebenbefund (#3137): der volle Vitest-Lauf zeigte den Legacy-Alias-Ratchet
  (#3051) rot, und zwar schon auf develop ohne die Teil-2-Änderungen:
  `LessonReviewReport.tsx` aus #3134 nutzt `var(--surface)` und
  `var(--border)`; die PR-CI hatte den Ratchet nicht gewählt (er liest per
  `readFileSync`, Klasse #1620/#1665). Behoben im selben PR durch die
  semantischen Utilities `bg-surface` / `border-border`, Pins unverändert.
- Commit: siehe PR.

## Fragen und Annahmen

- Der Sync-Push mit `GITHUB_TOKEN` löst keine PR-CI aus; dieser
  Journal-Commit ist der echte Push, der die Checks auf dem Sync-Head
  startet (gleiche Lage wie am 2026-09-15).
- #3124: "Wenn's mobil ist dann nur the Screen" ist als "die kompakte
  Fassung passt am Telefon auf einen Bildschirm" gelesen, nicht als "am
  Telefon gibt es keinen Knopf für die ausführliche Auswertung"; die
  Feature-State-Policy (#335) verbietet das Verstecken eines Merkmals nach
  Gerät.
- #3124 Teil 2: der im Issue-Kommentar vorgeschlagene Satz (Korrekturrunde
  und Nächste Schritte an) wurde nach der Messung verworfen, weil er auf
  keinem Telefon einen Bildschirm ergibt; die Voreinstellung folgt dem
  Wortlaut der Erwartung (Ergebnis, XP, Kennzahlen, Weiter-Knopf). Die
  drei Kennzahlen sind die vorhandenen Sterne, Punktzahl und Zeit; eine
  neue Kennzahlen-Zeile wurde nicht gebaut. Wer die Karten oder die
  Korrekturrunde in der kompakten Fassung will, hakt sie in den
  Einstellungen an.
