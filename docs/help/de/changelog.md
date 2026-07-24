# Was ist neu (v1.61 – v1.91)

Ein nutzerorientierter Überblick über die Releases seit v1.61.0.
Die vollständigen, technischen Notizen pro Version stehen unter
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v1.91.0 - Navigations-Umbau

- **Hauptnavigation von über 12 auf 7 gruppierte Einträge**
  reduziert (Dashboard, Lernpfad, Meine Inhalte, Entdecken,
  Fortschritt, Settings, Help) - ohne Funktionsverlust, jede
  Seite bleibt erreichbar ([Navigation](user-guide/navigation.md)).
- **Mobile Bottom-Tab-Leiste** (Lernen / Inhalte / Entdecken /
  Fortschritt / Mehr) mit „Mehr"-Bottom-Sheet.
- **ProgressHub** (`/progress`) gruppiert Übersicht / Statistik /
  Meine Pfade in Tabs; **DiscoverHub** (`/discover`) bekommt einen
  Import-Tab. Alte Links bleiben über Redirects gültig.
- Das PWA-Update-Banner taucht nach „Aktualisieren" nicht wieder auf.

## v1.90.0 - KI-Übungsgenerierung + Auto-Update

- **KI-Übungsgenerierungs-Pipeline**: Übungen für eine reine
  Theorie-Lektion erzeugen, mit Qualitäts-Gate, Typ-Balancierung,
  Regenerieren-mit-Feedback und Batch-Erzeugung für ein ganzes Set
  ([KI-Übungsgenerierung](features/ai-exercise-generation.md)).
- **Animierte Paar-Auflösung** in der Matching-Übung.
- **Test-Knopf pro Anbieter** in der Anbieter-Übersicht
  ([Einstellungen](user-guide/settings.md)).
- **Desktop-Auto-Update-Prüfung** über die GitHub-Releases-API.
- KI-Session-Antworten kommen jetzt in deiner UI-Sprache zurück.

## v1.87.0–v1.88.0 - Content-Entdeckung + QR-Sharing

- **Content-Entdeckung (`/discover`)**: ein Suchindex über die
  Bibliothek; der Set-Download ist hierher gewandert, getrennt von
  deinen lokalen „Meine Inhalte" ([Entdecken](features/discover.md)).
- **QR-Code-App-Sharing**: die App über einen scannbaren QR-Code
  teilen (kopieren / PNG laden / nativ teilen).
- **Curriculum-Builder** + tägliche Lern-Erinnerungen.
- **Koreanisch + Indonesisch** kommen dazu (jetzt 11 Sprachen).

## v1.86.0–v1.87.0 - KI-Inhaltsprüfung + `.alb`-Backup

- **KI-Inhaltsprüfung**: set-weite Qualitätschecks mit Report-UI,
  gecachtem Report + Markdown-Export und einem „KI-geprüft"-Badge
  ([KI-Inhaltsprüfung](user-guide/ai-validation.md)).
- **Medien-Integration**: ein „Vertiefe das Thema"-Lektionsabschnitt.
- **`.alb`-ZIP-Backup-Format** ersetzt den einzelnen JSON-Dump und
  trägt jetzt auch einen localStorage-Snapshot
  ([Backup und Wiederherstellung](features/backup.md)).

## v1.70.0–v1.84.0 - UX, Theming und TipTap 3

- **Erstinstallation-Restore**: eine leere Installation bietet im
  Onboarding „Aus Backup wiederherstellen" an.
- **Doku-Überarbeitung** + kontextsensitive In-App-Hilfe.
- **TipTap-Editor von v2 auf v3 migriert** (ganzer `@tiptap/*`-Stack).
- **Feature-Strategy-Gating**: KI-Funktionen wechseln ohne Reload
  zwischen aktiv / deaktiviert / versteckt.
- Umfangreiche Dark-Theme-Kontrast- und Mobile-Layout-Härtung.

## v1.69.0 - Beispiel-Links + Buchempfehlungen

- **Beispiel-Links in Theorie:** Ein Theorieschritt kann einen
  optionalen „Beispiel ansehen"-Link tragen.
- **Buchempfehlungen pro Domäne** im Content Browser
  ([Buchempfehlungen](content-creation/books.md)).
- **Enter-Shortcut auch im Fehler-Replay** („Fehler wiederholen").
- **Backup-Fix:** Set-Titel wird beim Wiederherstellen korrekt aus
  dem Manifest gelesen.

## v1.68.0 - Ergebnis-Export + Theorie-Rücklinks

- **Lektionsergebnis exportieren:** „Ergebnis kopieren" / „Als
  Datei speichern" (Markdown-Report für KI-Assistenten).
- **Theorie-Rücklinks:** Aus einer Übung zur passenden Theorie
  springen und zurück.
- **Zuordnungsübung überarbeitet:** farbige Paare + Nummern-Badges
  (farbenblind-sicher).
- **Dark-Mode-Kontrast** an mehreren Stellen korrigiert.

## v1.67.1 - Backup-Restore + Deploy-Stabilität

- Systematischer **Backup-Wiederherstellungs**-Fix.
- Auto-Neuladen bei veraltetem Deploy-Chunk.
- Subject-Filter-Politur (versteckt bei ≤ 1 Subject,
  meistgenutzt zuerst).

## v1.65.0 - Fortsetzbares Assessment + Enter-Shortcut

- **Fortsetzbares Assessment:** Test abbrechen und später dort
  weitermachen, wo du aufgehört hast.
- **Enter-Shortcut:** Enter prüft eine beantwortete Übung und geht
  weiter (umschaltbar in Einstellungen → Lernen).
- Deutlichere Zuordnungsübungen + Design-Token-Durchlauf.

## v1.64.0 - Onboarding-Überarbeitung

- **Schnellstart mit nur Name + Thema**; der Rest nimmt Vorgaben.
- Optionaler **Onboarding-Assistent** (eine Frage pro Bildschirm).
- Das **Assessment ist jetzt optional** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 - WCAG-AA-Theme-Presets

- **6 empfohlene Themes** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), rechnerisch AA-konform
  ([Theme-System](developer/themes.md)).
- Systematischer i18n-Audit; nutzerbezogener Dashboard-Filter.

## v1.62.0 - Backup-Integrität + Build-Provenienz

- Härtung der **Backup-Wiederherstellung** (Datentyp-Coercion,
  FK-Reihenfolge).
- About zeigt echte Build-Infos statt „unknown".

## v1.61.0 - Button-Konformität + Lektions-Resume

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
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) - vollständige Notizen
