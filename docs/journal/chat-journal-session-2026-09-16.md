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
  i18n-Schlüssel.
- Commit: siehe PR.

## Fragen und Annahmen

- Der Sync-Push mit `GITHUB_TOKEN` löst keine PR-CI aus; dieser
  Journal-Commit ist der echte Push, der die Checks auf dem Sync-Head
  startet (gleiche Lage wie am 2026-09-15).
