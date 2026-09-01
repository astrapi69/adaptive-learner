# Chat-Journal — Session 2026-09-01

## 1. Spielmodus: Einstellung + Lektionsstart-Hinweis (#2844)
- Original prompt: "Wir haben zwar ein spielermodus aber das sieht nicht richtig aus wie ein Spiel. Was ich möchte ist es das der user ein Spielmodus hat und wenn der aktiv ist werden die Aufgaben spielerisch gestaltet. Was muss da gemacht werden? Soll das in der engine sein oder in der app?" -> "ok dann fangen wir an und wie gesagt erstmal als einstellung ein modus den man einschaltet oder man kann auch am Anfang darauf hinweisen"
- Optimized prompt: "Baue einen Spielmodus als Nutzer-Einstellung (localStorage, orthogonal zu den 7 Lesson-Modi): Toggle in Settings > Lernen, dismissbarer Entdeckungs-Hinweis beim Lektionsstart, und bei aktivem Modus die effektive Feedback-Intensität auf 'enthusiastic' anheben; reiche das playful-Flag über den LessonModeProvider an die Renderer durch."
- Ziel: Der erste Schritt zu spielerisch gestalteten Aufgaben - der Modus existiert, ist entdeckbar und spürbar; die Renderer-Ausbaustufen (Combo, XP-Leiste in der Lektion, Runden-Score) folgen als eigene Issues.
- Architektur-Entscheid (auf die Frage Engine vs. App): App. Die learn-content-engine ist ein reines Schema-/Parse-Paket ohne Präsentationsfläche (kein `presentation`/`ui`-Key im Schema), byte-paritäts-gegated und extern released; die App besitzt mit `MODE_CONFIGS` bereits die passende Abstraktion. Engine-Erweiterungen würden erst nötig, wenn Content-Autoren spielspezifische Daten autorieren sollen (Punktwerte, Boss-Level) - bewusst vertagt.
- Ergebnis:
  - Neue Pref `lib/learning/playfulModePref.ts` (Muster `lessonModePref`): `adaptive-learner.lesson.playful_mode` (Default aus) + `playful_mode_hint_dismissed`, eigenes Change-Event; browser-lokal, in beiden Speicher-Modi identisch, kein Backend.
  - `effectiveIntensity()` (`lib/feedback/feedbackPref.ts`) hebt bei aktivem Spielmodus auf "enthusiastic" (Lob auf jede richtige Antwort, Konfetti, Milestones); `prefers-reduced-motion` bleibt übergeordnet und gewinnt weiterhin. `useFeedbackIntensity` hört zusätzlich auf das Spielmodus-Event (live ohne Reload).
  - `playful`-Feld im `LessonModeConfig` (statisch `false` in allen 7 Modus-Zeilen); `LessonModeProvider` overlayt das Flag live via neuem Hook `hooks/settings/usePlayfulMode.ts` - der Einspeisepunkt für künftige spielerische Renderer-Varianten, orthogonal zum Modus.
  - Settings-UI: neue Sektion `PlayfulModeControl` (`settings-section-playful`, Motivation-Gruppe vor der Feedback-Sektion); Order-Test in `Settings.test.tsx` erweitert.
  - Lektionsstart: `PlayfulModeHint`-Banner (`components/lesson/chrome/`) auf dem ersten Schritt, solange Modus aus + nie ausgeblendet; "Einschalten" aktiviert in place (Toast) und beendet den Hinweis dauerhaft, Schließen blendet dauerhaft aus.
  - i18n: 8 neue Schlüssel (`settings.playful_mode*`, `lesson.playful_hint_*`) in allen 11 Katalogen, `make sync-i18n`; Backend-Paritätstest 51/51 grün, `verify_i18n_scripts` sauber.
  - TDD: Pref-, Floor-, Config-, Toggle- und Banner-Tests zuerst RED, dann GREEN; Testplan DE+EN um die Spielmodus-Sektion ergänzt (TESTPLAN-PFLICHT).
- Commit: siehe PR (Closes #2844).

## Fragen und Annahmen
- Konservative Annahme: Der Intensitäts-Floor überschreibt auch eine bewusst gewählte "dezent"-Einstellung, solange der Spielmodus an ist - der Modus ist Opt-in und seine Beschreibung benennt genau das; reduced-motion bleibt als Barrierefreiheits-Override unangetastet.
- Konservative Annahme: Der Sound bleibt vom Spielmodus unberührt (weiter eigenes Opt-in, Default aus) - ein Modus-Toggle, der ungefragt Ton einschaltet, wäre invasiv.
- Evidenzbasiert entschieden: localStorage-Pref statt `IStorageService`/UserSettings (etablierte Konvention für Lern-Prefs: `lessonModePref`, `feedbackPref`, `gamificationPref`); Banner-Gestaltung nach dem `TestModeBanner`-Muster; Hinweis nur auf dem ersten Schritt, damit er nicht durch die Lektion nagt.
- Prozessnotiz: PR-Scope-Regel #2578 (Übersetzungen zuerst als eigener PR) kollidiert mit der Dispatch-Vorgabe, ausschließlich auf `claude/spielmodus-gamification-9d8311` zu pushen - gelöst als eigener i18n-Commit VOR dem Feature-Commit im selben PR.
