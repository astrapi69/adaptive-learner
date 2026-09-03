# Chat-Journal 2026-09-03

Fortsetzung der Spielmodus-Session vom 2026-09-02 (Freischalt-Umbrella
#2886). Branch: claude/spielmodus-gamification-9d8311, PRs gegen
develop.

## 1. Lern-Memory: Vorauswahl folgt dem Lernkontext (#2899/#2900) (08:20)

- Original prompt: "wenn man die Spiele Lern-Memory nimmt sollte das
  aktuelle Lernset gewählt werden ... ich war in Psychologie
  Grundlagen und bekam Englisch ... Die Frage ist auch ob man den
  Dropdown anbieten sollte."
- Optimierter Prompt: "Fixe die Memory-Set-Vorauswahl auf das zuletzt
  gelernte, noch heruntergeladene Set (Continue-Learning-Ranking);
  behalte den Dropdown fuer bewusste Set-Wahl; Fallback bleibt das
  erste gecachte Set."
- Ziel: Bug #2899 beheben, Dropdown-Frage beantworten.
- Ergebnis: reine Funktion preferredMemorySetId (4 parametrisierte
  Faelle) + MemoryGame-Wiring ueber groupRecentProgress; Empfehlung
  "Dropdown behalten, Vorauswahl fixen" von Aster bestaetigt ("ja
  richtig sehr gut"). Testplan DE+EN praezisiert. Als deklarierte
  Mitfahrer im selben PR: die reinen Stufe-D-lib-Module (der
  Session-Branch ist gepinnt, die Stop-Hook-Disziplin verlangt
  gepushte Arbeit).
- Commit: d8ccf034 + ef144c53, Squash-Merge 5bc70905 (PR #2900).

## 2. Stufe D: Bonus-Lektionen als App-Konvention (#2890) (08:50)

- Original prompt: "Stufe D: App-Konvention, kein Engine-Schema - leg
  los mit #2890" und "weiter mit Stufe D bis zum Merge".
- Optimierter Prompt: "Implementiere Bonus-Lektionen ueber das
  bonus--Dateinamens-Praefix (keine Engine-Aenderung): abgeleitete
  Freischaltung (jede regulaere Lektion mit mindestens einem Stern,
  via LessonProgress ueber die Storage-Abstraktion - beide Modi und
  Backup automatisch), Bonus ans Listenende, sichtbar-aber-gesperrt
  auf der Set-Seite mit Tooltip, Blitzrunden-Freischaltung nur ueber
  regulaere Lektionen, Spielmodus-Schalter Standard AN, Autoren-Doku
  DE+EN; i18n zuerst, Testplan DE+EN."
- Ziel: #2890 komplett auf einem PR; Checkbox D + Umbrella #2886
  schliessen.
- Ergebnis: lib/content/browse/bonus-lessons (Konvention, Unlock,
  Sortierung; 12 Tests gegen echte Row-Shapes), playfulBonusPref
  (3 Tests), isBonus-Flag im Listen-Modell, SetDeepLink-Sperre mit
  Badge/Schloss/Tooltip + Lernen-starten-Schutz (4 Tests),
  FlashRoundCard-Filter (1 Test), Settings-Toggle (2 Tests);
  i18n-Block (4 Keys x 11 Kataloge); Autoren-Doku
  authoring-content.md DE+EN, Hilfe celebrations.md DE+EN, Testplan
  DE+EN.
- Architektur-Entscheidung (Aster): App-Konvention statt
  learn-content-engine-Schema - sofort umsetzbar, kein Engine-Re-Pin
  mit sync-schema-Kette (#2265), Marker im Dateinamen, damit jede
  Flaeche ohne Lesson-Load klassifizieren kann.
- Commit: siehe PR #2890-Zweig (i18n, Feature, Docs).

## 3. Weitere Arcade-Spiele: TicTacToe (#2905/#2906) (09:50)

- Original prompt: "wir sollten noch ein paar einfache spiele
  anbieten, welche von denen sind schnell implementiert?" (mit
  Qwen-Analyse zu Pac-Man/Tetris/Pong) und die Bestätigung
  "richtige einschätzung ... damit sollten wir weitermachen".
- Optimierter Prompt: "Bewerte die Kandidaten gegen die
  Arcade-Leitplanken (1-2 Minuten, gewinnbar, reiner
  Reducer + DOM-Grid) und implementiere TicTacToe (100 XP) und
  Simon (300 XP) als eigene Issues/PRs; verwerfe Tetris
  (Endlosspiel), Pac-Man (zu gross), Pong (monoton)."
- Ziel: Umbrella #2905 mit TicTacToe #2906 und Simon #2907;
  TicTacToe zuerst.
- Ergebnis TicTacToe: reiner Reducer mit bewusst schlagbarer KI
  (nimmt den eigenen Gewinnzug, blockt nur mit 70 Prozent,
  injizierter Zufall; 16 Tests), Komponente mit Denk-Pause vor dem
  KI-Zug (3 Tests), Katalog-Eintrag auf der Preisleiter
  Memory frei -> TicTacToe 100 -> Snake 200 (+1 Katalog-Pin,
  +2 Arcade-Tests inkl. Ticket-Runde); i18n-Block (8 Keys x 11);
  Testplan DE+EN, Hilfe celebrations.md.
- Commit: siehe PR-Zweig (#2906: i18n, Feature, Docs).

## Fragen und Annahmen

- Gate-Semantik Bonus-Lektionen: Sperre NUR bei aktivem Spielmodus +
  Bonus-Schalter; ohne Spielmodus normale Lektion. Konservative
  Auslegung der #2886-Leitplanken (Zusatzflaechen, kein Inhalt wird
  vorenthalten); im Issue/PR dokumentiert.
- Pilot-Grenze: sichtbar-aber-gesperrt lebt auf der Set-Seite (der
  kanonischen Flaeche); andere Listen (Meine Lektionen, Lernpfad)
  und direkte Lesson-URLs behandeln Bonus wie normale Lektionen.
  Bewusst, weil das Gate Dramaturgie ist, kein Schutz - im PR
  dokumentiert.
- Bonus-Content existiert noch nicht; die Konvention ist in der
  Autoren-Doku beschrieben, damit Asters Kurs-Repos sie nutzen
  koennen (Frage 2 des Issues bleibt Content-Arbeit ausserhalb des
  App-Repos).
