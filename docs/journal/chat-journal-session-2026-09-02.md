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
