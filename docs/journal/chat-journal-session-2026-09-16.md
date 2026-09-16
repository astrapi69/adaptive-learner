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

## Fragen und Annahmen

- Der Sync-Push mit `GITHUB_TOKEN` löst keine PR-CI aus; dieser
  Journal-Commit ist der echte Push, der die Checks auf dem Sync-Head
  startet (gleiche Lage wie am 2026-09-15).
