# Chat-Journal - Session 2026-09-02

Fortsetzung der Spielmodus-/Figuren-Session vom 2026-09-01 (gleiche
Remote-Session, gepinnter Branch `claude/spielmodus-gamification-9d8311`).

## 1. Maskottchen-Varianten (#2861) (08:15)

- Original prompt: "ja mach die Maskottchen-Varianten als nächstes"
- Optimierter Prompt: "Implementiere die im #2847-Abschluss notierte
  Anschlussidee: freischaltbare Farbwelten des Lernfunke (#2849) mit
  derselben Level/Badge/XP-Progressionsmechanik wie die Avatar-Rahmen
  (#2850), inklusive Extraktion der jetzt doppelt gebrauchten
  Unlock-/Store-/Kauf-Logik."
- Ziel: Der Spielmodus-Begleiter wird personalisierbar und die
  XP-Wirtschaft bekommt einen weiteren Konsumenten.
- Ergebnis:
  - Issue #2861 (GITHUB-ISSUE-PFLICHT), Branch neu von develop
    (der #2860-Merge war der Endpunkt des vorherigen PR).
  - i18n zuerst als eigener Commit (#2578-Reihenfolge): 12 Keys in
    allen 11 Katalogen. Bewusste Entscheidung: die Bedingungs-/
    Kauf-Strings heißen generisch `settings.unlock_*` (nicht
    `mascot_*`), damit die dritte Cosmetics-Fläche keine weitere
    Duplikat-Reihe anlegt; die Werte übernehmen die etablierte
    Formulierung der Frame-Keys pro Katalog.
  - DRY-Extraktion mit zweitem Konsumenten: `lib/gamification/
    unlockables.ts` (Bedingungsmodell + reine Auswertung),
    `lib/gamification/selection-store.ts` (Factory für den
    localStorage+Dexie-Spiegel-Store, neu mit Change-Event pro
    Schreibvorgang), `hooks/gamification/useXpPurchase.ts`
    (zweistufiger, affordability-geprüfter Kauf). Die
    #2850-Module delegieren; Storage-Key, Datenformat und die
    bestehenden Tests blieben unverändert (und grün) - das ist der
    Beweis, dass der Refactor verhaltensneutral war.
  - Katalog `lib/mascot/mascot-variants.ts`: funke (frei), ozean
    (Level 3), wald (Level 7), geist (Badge first_session), gold
    (250 XP). Nur bestehende theme-agnostische Tokens, kein neues
    CSS - der css-size-Ratchet bleibt unberührt.
  - `LernfunkeFigure` bekommt optionale Farb-Props (Default =
    bisherige Funke-Farben), `LessonMascot` liest die Variante live
    über das Store-Event, `MascotVariantControl` rendert in der
    Spielmodus-Sektion (Settings > Lernen).
  - Persistenz: Key `adaptive-learner.mascot.variants` registriert
    in `MANAGED_USER_DATA_KEYS` + `.alb`-Snapshot-Pin (die
    #2053-Klasse vorbeugend geschlossen).
  - TDD: 7 Unlockable-, 6 Factory-, 5 Katalog-, 4 Store-, 1 Figure-,
    2 Mascot- und 5 Control-Tests waren rot vor der Implementierung.
  - Testplan DE+EN um die Varianten-Sektion ergänzt
    (TESTPLAN-PFLICHT).
- Commits: 312fd8dc (i18n), 5fbfc11d (Feature), Testplan/Journal im
  Doku-Commit; PR gegen develop folgt in dieser Session.

## 2. Hilfe-Doku für den Spielmodus-Bogen (08:45)

- Original prompt: "die Dokumentation entsprechend anpassen und sag
  mir wo das in den Einstellungen ist?"
- Ergebnis: celebrations.md + settings.md (DE+EN) dokumentieren
  erstmals den ganzen Spielmodus-Bogen (Schalter, Lernfunke,
  Varianten, Profil-Kosmetik). Boy-Scout-Korrektur: die Hilfe
  behauptete "Einstellungen > Oberfläche" für Feedback-Intensität
  und Töne - beide rendern im Lernen-Tab. Antwort an Aster:
  Maskottchen-Variante liegt unter Einstellungen > Lernen >
  Spielmodus, Avatar-Rahmen unter Allgemein > Profil.
- Commit: e2fb13a2 (im #2863-PR gemerged).

## 3. Foto-Bestätigungsdialog + Zwischenspeicher (#2862) (09:00)

- Original prompt: "Wenn der user ein Bild hochgeladen hat soll wenn
  eine Figur gewählt wird ein Bestätigungsdialog kommen das dass
  foto gelöscht wird, aber der anwender kann das foto in ein
  zwischenspeicher haben oder?"
- Befund, der die Anforderung bestätigt: das Foto ist eine Data-URL
  in `UserSettings.avatar`; der Figuren-Klick überschrieb es
  stillschweigend und unwiederbringlich.
- Ergebnis: Issue #2862; `avatar-photo-stash` (ein Slot pro Nutzer,
  mentor-notes-Muster, MANAGED_USER_DATA_KEYS + Snapshot-Pin),
  `isPresetAvatarDataUrl` am Katalog, neue Komponente
  `PresetAvatarPicker` (Galerie + ConfirmDialog + Wiederherstellen -
  extrahiert, damit der Flow ohne GeneralPanel-Gesamtkontext testbar
  ist), Stash-Clear in `handleAvatarChange`, sobald wieder ein
  echtes Foto aktiv ist (frischer Upload oder Restore). i18n (4 neue
  Keys, Cancel via `common.cancel`), Testplan DE+EN (inkl. Korrektur
  des Alt-Schritts "Figur wählen ersetzt das Foto"), Hilfe
  settings.md DE+EN.
- Konservative Annahme: der Slot hält genau EIN Foto (das zuletzt
  verdrängte); Quota-Fehler beim Stash-Schreiben werden geschluckt
  (etabliertes Store-Muster), der Wechsel schlägt dadurch nie fehl.
- Commits: 715dac85 (i18n), 48c8477a (Feature), Doku-Commit folgt.

## 4. Spielgefühl-Umbrella + Stufe A Juice-Paket (#2873/#2874) (12:00)

- Original prompt: "Ich habe jetzt ... den Spieler Modus aktiviert ...
  Aber der einzige Unterschied ist, dass ... das Maskottchen oben
  angezeigt wird. ... ich spüre kein Spieleffekt Brainstorming, was
  ist da am besten?"
- Diagnose (bestätigt den Eindruck): der Modus hebt nur die
  Feedback-Intensität; Töne sind eigener Opt-in; das playful-Flag in
  LessonModeConfig hat KEINEN Renderer-Konsumenten - der Andockpunkt
  ist leer.
- Brainstorming-Ergebnis (AskUserQuestion, Aster wählte ALLE vier):
  Umbrella #2873 mit A Juice (#2874), B Sounds (#2875), C Renderer
  (#2876), D Herzen/Timer (#2878), Reihenfolge A->B->C->D.
- Stufe A umgesetzt: combo.ts-Reducer + useLessonCombo (ein
  Hook-Exemplar in Lesson.tsx, Chip und Summary lesen dieselbe
  Serie), LessonCombo-Chip (ab x2, Summary zeigt "Beste Serie"
  statt Prop-Drilling durch die Summary-Interfaces), "+1"-Float +
  Häkchen-Hüpfer/X-Schütteln in AnswerCelebration (die EINE
  gemeinsame Feedback-Stelle - alle 15 Renderer profitieren ohne
  Einzelumbau), Checkpoint-Punkte bei 1/3 und 2/3 im
  Fortschrittsbalken.
- Bewusste Grenzen: kein Combo-Bonus-XP (Scoring unangetastet,
  Entscheidung liegt bei #2878); nur EIN neuer Keyframe
  (juice-float-up, css-size 7486->7499 mit Begründung), alle anderen
  Animationen re-usen lernfunke-hop/-pop und matching-shake;
  Prüfungsmodus bleibt still, weil der Bus dort nichts emittiert
  (kein Extra-Gate nötig).
- Commits: 1fc5090e (i18n), aaf2938b (Feature), Doku-Commit folgt.

## 5. Stufe B Spielmodus-Sounds (#2875) (13:45)

- Fortsetzung des #2873-Umbrellas nach dem #2874-Merge (PR #2879).
- Ergebnis: `playfulSoundsPref` (zweiter, unabhängiger Opt-in neben
  dem globalen Töne-Schalter, plus Einmal-Angebot-Flag);
  `soundOutputEnabled()` in der Sound-Schicht (global ODER
  Spielmodus+Sound-Flag), `playSound` mit `pitchSteps`
  (Halbton-Faktor), zwei neue Synth-Rezepte (checkpoint, fanfare);
  der Celebration-Bus verfolgt die Antwort-Serie selbst und hebt
  die Tonhöhe des Correct-Tons pro Combo-Stufe (Kappung bei 8
  Halbtönen, außerhalb des Spielmodus flach - klassisches
  Verhalten unverändert); neuer Event-Typ `checkpoint` (emittiert
  vom Fortschrittsbalken beim Überschreiten, ein Event pro
  Navigation); Fanfare bei `lesson_complete` nur mit aktivem
  Spielmodus-Sound. UI: Schalter + Einmal-Angebot in der
  Spielmodus-Sektion, "Mit Sound einschalten"-Knopf im
  Lektions-Banner.
- Konservative Annahmen: Lautstärke bleibt der bestehende Regler
  (kein zweiter); Prüfungsmodus bleibt pro Antwort stumm (der Bus
  emittiert dort nichts), die Fanfare am Ende ist erlaubt; jeder
  Klang hat ein sichtbares Pendant (Töne bleiben ergänzend).
- Commits: d2092776 (i18n), Feature-/Doku-Commits folgen.

## 6. Stufe C Spielerische Übungs-Renderer, erste Tranche (#2876) (15:00)

- Original prompt: Fortsetzung des Umbrella-Beschlusses #2873 (Stufe C nach
  Merge von Stufe B via PR #2880; dort fand die Baseline-Runde zusätzlich
  einen Mobile-Umbruchfehler des Hinweis-Banners, im selben PR gefixt).
- Optimized prompt: "Konsumiere das playful-Flag in den drei häufigsten
  Übungs-Renderern als reine Präsentationsschicht: MC-Kacheln,
  Lückentext-Wortsprung, Matching-Pop - gleiche Testids, gleiches Scoring,
  motion-safe."
- Ziel: Der Spielmodus verändert erstmals die Übungen selbst, ohne
  Verhalten oder Bewertung anzufassen.
- Ergebnis: MultipleChoiceExercise rendert im Spielmodus ein
  Kachel-Raster (ab sm zweispaltig, Pop bei Wahl, Hüpfer/Schütteln auf dem
  Urteil); ClozeSelectChoices lässt das gewählte Wort per lernfunke-hop in
  die Satz-Lücke springen (Key-Wechsel wiederholt die Animation);
  Matching-Kacheln ploppen beim Paaren und hüpfen bei richtiger Auflösung.
  Alle drei Wurzeln tragen data-playful. Bewusste Abweichung vom
  Issue-Wortlaut: "gelöste Paare fliegen ab" wäre eine Verhaltensänderung
  (Antippen eines Paars löst es heute wieder) - stattdessen nur das
  Zusammenschnappen; im PR dokumentiert. Keine neuen i18n-Strings (reine
  Optik). Drei neue parametrisierte Paritäts-Testdateien (17 Tests),
  Testplan DE+EN, Hilfe celebrations.md DE+EN erweitert.
- Commit: siehe Feature- und Doku-Commit dieses PR (Refs #2876).

## Fragen und Annahmen

- Farbwahl der Varianten aus der bestehenden Markenpalette
  (`--method-*`, `--frame-gold`) statt neuer Tokens - konservativ,
  kein css-size-Ratchet-Raise nötig. Quelle: design-tokens.md
  ("neue Farbe nur als Token"; hier existieren die Tokens bereits).
- Freischalt-Schwellen (Level 3/7, Badge first_session, 250 XP) sind
  Produktentscheidungen ohne Vorgabe; gewählt so, dass sie die
  Frame-Schwellen (2/5/10, streak_3_days, 150/300) versetzt ergänzen
  und früh einen erreichbaren Erfolg bieten. Im Issue dokumentiert.
- Die Varianten-Galerie rendert INNERHALB der Spielmodus-Sektion
  (nicht als eigene Sektion), weil das Maskottchen nur im Spielmodus
  auftritt; sie bleibt aber auch bei ausgeschaltetem Spielmodus
  sichtbar (Feature-State-Policy #335: nichts verstecken).
