# Was ist neu (v1.61 – v1.69)

Ein nutzerorientierter Überblick über die Releases seit v1.61.0.
Die vollständigen, technischen Notizen pro Version stehen unter
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v1.69.0 — Beispiel-Links + Buchempfehlungen

- **Beispiel-Links in Theorie:** Ein Theorieschritt kann einen
  optionalen „Beispiel ansehen"-Link tragen.
- **Buchempfehlungen pro Domäne** im Content Browser
  ([Buchempfehlungen](content-creation/books.md)).
- **Enter-Shortcut auch im Fehler-Replay** („Fehler wiederholen").
- **Backup-Fix:** Set-Titel wird beim Wiederherstellen korrekt aus
  dem Manifest gelesen.

## v1.68.0 — Ergebnis-Export + Theorie-Rücklinks

- **Lektionsergebnis exportieren:** „Ergebnis kopieren" / „Als
  Datei speichern" (Markdown-Report für KI-Assistenten).
- **Theorie-Rücklinks:** Aus einer Übung zur passenden Theorie
  springen und zurück.
- **Zuordnungsübung überarbeitet:** farbige Paare + Nummern-Badges
  (farbenblind-sicher).
- **Dark-Mode-Kontrast** an mehreren Stellen korrigiert.

## v1.67.1 — Backup-Restore + Deploy-Stabilität

- Systematischer **Backup-Wiederherstellungs**-Fix.
- Auto-Neuladen bei veraltetem Deploy-Chunk.
- Subject-Filter-Politur (versteckt bei ≤ 1 Subject,
  meistgenutzt zuerst).

## v1.65.0 — Fortsetzbares Assessment + Enter-Shortcut

- **Fortsetzbares Assessment:** Test abbrechen und später dort
  weitermachen, wo du aufgehört hast.
- **Enter-Shortcut:** Enter prüft eine beantwortete Übung und geht
  weiter (umschaltbar in Einstellungen → Lernen).
- Deutlichere Zuordnungsübungen + Design-Token-Durchlauf.

## v1.64.0 — Onboarding-Überarbeitung

- **Schnellstart mit nur Name + Thema**; der Rest nimmt Vorgaben.
- Optionaler **Onboarding-Assistent** (eine Frage pro Bildschirm).
- Das **Assessment ist jetzt optional** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 — WCAG-AA-Theme-Presets

- **6 empfohlene Themes** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), rechnerisch AA-konform
  ([Theme-System](developer/themes.md)).
- Systematischer i18n-Audit; nutzerbezogener Dashboard-Filter.

## v1.62.0 — Backup-Integrität + Build-Provenienz

- Härtung der **Backup-Wiederherstellung** (Datentyp-Coercion,
  FK-Reihenfolge).
- About zeigt echte Build-Infos statt „unknown".

## v1.61.0 — Button-Konformität + Lektions-Resume

- App-weite shadcn-Button-Konformität.
- **Pausierte Lektion** setzt am exakten Schritt fort.
- Cross-Repo-Inhaltsvalidierung.

---

## Größere Stränge im Zeitraum

- **Mehrere Content-Repositories (EXP-023):** eigene Repos
  verbinden, mehrere verwalten, teilen per Link/QR, Trust-Stufen,
  empfohlene Repos, lokale Bewertungen
  ([Mehrere Content-Repositories](features/content-repos.md)).
- **Backup als vollständiger Snapshot** mit Cross-Identity-Import
  ([Backup und Wiederherstellung](features/backup.md)).

---

## Verwandte Seiten

- [Erste Schritte](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) — vollständige Notizen
