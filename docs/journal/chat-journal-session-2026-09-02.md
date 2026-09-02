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

## Offene Punkte aus der Session

- Neue Anforderung von Aster (während der Umsetzung eingegangen):
  Beim Wählen einer Preset-Figur, während ein hochgeladenes Foto
  aktiv ist, soll ein Bestätigungsdialog erscheinen; das Foto soll in
  einen Zwischenspeicher wandern und wiederherstellbar sein. Eigenes
  Issue, Umsetzung nach dem #2861-PR (das Foto ist heute eine
  Data-URL in `UserSettings.avatar` und geht beim Preset-Wechsel
  stillschweigend verloren - der Befund bestätigt die Anforderung).

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
