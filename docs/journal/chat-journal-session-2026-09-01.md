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

## 2. Brainstorming Figuren/Avatare + Folge-Issues (#2847-#2850)
- Original prompt: "können wir auf irgendwelche figuren oder avatars oder beides, brainstorming" -> "Beides, gestuft" + "erst 1, 2 und 3 als folge issue"
- Ziel: Ausbaupfad für Figuren im Spielmodus festhalten, bevor implementiert wird.
- Ergebnis: Umbrella #2847 (Leitplanken: Token-SVGs, keine neuen Dependencies, reduced-motion, beide Speicher-Modi, Maskottchen nur hinter dem playful-Flag) mit Sub-Issues #2848 (Stufe A: Preset-Avatar-Galerie), #2849 (Stufe B: Maskottchen am Celebration-Bus, Stil-Entscheid offen, Funke empfohlen), #2850 (Stufe C: Progression über Level/Badges/XP-Spend).

## 3. Stufe A: Preset-Avatar-Galerie (#2848)
- Original prompt: "ja dann kannst du mit stufe a weitermachen"
- Optimized prompt: "Ergänze in Settings > Allgemein > Profil eine Galerie aus 8 Preset-Figuren neben dem Foto-Upload; die Auswahl persistiert über den bestehenden UserSettings.avatar-Pfad und überlebt den Backup-Round-trip."
- Ziel: Niedrigschwellige, DSGVO-freundliche Avatar-Wahl ohne Foto.
- Architektur-Entscheid (Format): SVG-**data-URLs mit eingebackenen Markenpalette-Farben** (METHOD_COLORS + 2 Erweiterungen) statt Preset-Id + Renderer. Grund: beide Render-Stellen (`NavAvatar`, `AvatarUpload`-Vorschau) zeigen `<img src>`, wo CSS-`var()` nicht auflöst; eine Id-Auflösung müsste jeden Konsumenten anfassen (#2477-Klasse). Avatare sind Nutzer-DATEN, nicht Chrome - dieselbe Token-Ausnahme wie User-Tag-Farben/Charts; Präzedenzfall `placeholder-svg.ts`. Die Token-SVG-Leitplanke aus #2847 bleibt für das inline gerenderte Maskottchen (Stufe B) bindend.
- Ergebnis:
  - `lib/avatar/preset-avatars.ts`: 8 deterministische Figuren (Funke, Roboter, Stern, Katze, Eule, Geist, Blitz, Herz) als `data:image/svg+xml;utf8,...`; unbekannte Id wirft; Größe weit unter dem Avatar-Byte-Cap.
  - `shared/media/PresetAvatarGallery.tsx`: props-driven (value/onSelect/Labels/disabled), `aria-pressed`-Markierung per data-URL-Vergleich, Barrel-Export.
  - Wiring in `GeneralPanel` (Profil-Sektion, unter dem Upload) über den bestehenden `handleAvatarChange`-Pfad - Persistenz, `notifyProfileUpdated` und beide Speicher-Modi kommen gratis mit.
  - Backup-Pin in `albContainer.test.ts`: eine utf8-SVG-data-URL wird NICHT externalisiert (Base64-Regex greift nicht), bleibt inline in `data.json` und überlebt den Round-trip unverändert.
  - Visuelle Eigenkontrolle: alle 8 Figuren in echtem Chromium gerendert und geprüft, Vorschau an den Nutzer geschickt.
  - i18n: 9 neue `settings.avatar_preset*`-Keys in allen 11 Katalogen, `make sync-i18n`; Testplan DE+EN (PRIO 11).
- Commit: siehe PR (Closes #2848, Refs #2847).

## 4. Stufe B: Lernfunke-Maskottchen im Spielmodus (#2849)
- Original prompt: "Weiter mit der nächsten Stufe"
- Optimized prompt: "Baue das Spielmodus-Maskottchen (Stil: Funke/Flamme, die dokumentierte Empfehlung): Token-SVG-Figur mit vier Posen am Celebration-Bus, Sprechblase mit Lob-Phrase beim Lektionsabschluss, klein in der Progress-Row und größer auf der Zusammenfassung, nur bei aktivem Spielmodus."
- Ziel: Der Spielmodus bekommt sein Gesicht - eine Begleitfigur, die auf das Lerngeschehen reagiert.
- Architektur-Entscheide:
  - Signal-Quelle ist der Celebration-Bus (`subscribeCelebration`): alle 15 Renderer emittieren `answer_correct/answer_wrong` bereits über `AnswerCelebration`, kein Renderer wird angefasst; Prüfungsmodus emittiert nichts (korrekt, kein Sofort-Feedback).
  - Kein Doppel-Lob: `AnswerCelebration` zeigt die Antwort-Phrase schon, und `nextCorrectAnswerIndex()` ist read-and-increment - das Maskottchen reagiert auf Antworten nur mit Posen; die Sprechblase spricht genau einmal, beim `lesson_complete` (Kategorie aus dem vorhandenen Praise-Katalog, 8 Sprachen mit EN-Fallback).
  - Ein Mount-Punkt in der Sticky-Progress-Row (außerhalb des `LessonModeProvider`, daher `usePlayfulMode()` direkt), `large` auf der Zusammenfassung; Milestone-Overlays (z-200, oben mittig) bleiben unberührt, das Maskottchen hängt am selben Bus statt an der Single-Listener-Queue.
  - Inline-Token-SVG (var(--method-contextual)/--fg-primary/--star/--bg-primary) - anders als die Stufe-A-Presets rendert die Figur inline, `var()` löst auf, die #2847-Leitplanke gilt.
  - Keyframes nach Konvention in neuem `styles/legacy/43-mascot.css` (global, `motion-safe:`-Konsum, 39-motion-catchall drosselt reduced motion); Posen wechseln auch ohne Motion (statische Mimik).
- Ergebnis: `components/lesson/mascot/` (Figur mit 4 Posen, `useMascotState` mit Decay + reactionKey für Animations-Restart, `LessonMascot` mit Sprechblase), Wiring in `Lesson.tsx`, 1 i18n-Key (`lesson.mascot_label`) in 11 Katalogen, Testplan DE+EN (Unterabschnitt der Spielmodus-Sektion), alle 4 Posen in echtem Chromium gerendert und geprüft (Vorschau an den Nutzer).
- Commit: siehe PR (Closes #2849, Refs #2847).

## 5. Stufe C: Avatar-Rahmen-Progression (#2850)
- Original prompt: "Okay, dann mach die Stufe C"
- Optimized prompt: "Baue Avatar-Rahmen als Progressions-Belohnung: Bronze/Silber/Gold über Level, Flamme über das streak_3_days-Abzeichen, Stern/Akzent kaufbar über gamification.spendXp - Auswahl und Käufe browser-lokal nach dem dismissed-sets-Muster, Backup-fähig, in beiden Speicher-Modi."
- Ziel: Die gesammelten XP bekommen einen Zweck; der bislang kaum genutzte spendXp-Pfad wird zum Konsumenten.
- Architektur-Entscheide:
  - **Kaufprüfung gehört dem Aufrufer**: `spendXp` klemmt in Backend UND Dexie bei 0 und lehnt nie ab - ohne eigenen Guthaben-Guard bekäme ein Nutzer ohne XP den Rahmen gratis. Der Kauf-Knopf ist unter dem Preis deaktiviert, der Kauf ein Zwei-Schritt-Confirm (Missions-Reset-Muster).
  - **Browser-lokaler Store** `lib/avatar/avatar-frame-store.ts` (mentor-notes-Vorlage): pro Nutzer `{selected, purchased}`; Key in `MANAGED_USER_DATA_KEYS` registriert (gepinnte Liste + Test erweitert), Snapshot-Pin in `localStorageSnapshot.test.ts` - kein Backend, kein per-Mode-Schreibpfad (#2053-Klasse vermieden).
  - **Ringe als token-only box-shadows** inline an den Render-Stellen; drei neue theme-agnostische Tokens `--frame-bronze/-silver/-gold` in `00-head.css` neben `--method-*` (der in der css-size-Regel selbst benannte Ausnahmefall "neue Farben als Token"; Baseline 7479 -> 7486 mit Begründung). Flamme/Stern/Akzent nutzen vorhandene Tokens.
  - **Live-Updates über bestehende Signale**: Auswahl/Kauf feuern `notifyProfileUpdated` (NavAvatar + Settings-Vorschau ziehen den Ring sofort nach) und `emitXpSpent` (Kopfleisten-XP-Badge blinkt/aktualisiert).
- Ergebnis: Katalog `lib/avatar/avatar-frames.ts` (7 Rahmen, 4 Unlock-Arten, pure `isFrameUnlocked`), Store, `AvatarFrameControl` (neue Concern-Gruppe `controls/profile/`), `frameRing`-Prop an `AvatarUpload`, Ring-Wrapper in `NavAvatar`; 14 i18n-Keys in 11 Katalogen; Testplan DE+EN (Unterabschnitt unter PRIO 11); alle 7 Ringe in echtem Chromium gerendert und geprüft.
- Commit: siehe PR (Closes #2850, Refs #2847 - damit ist das Umbrella komplett).

## Fragen und Annahmen
- Stil-Entscheid Stufe B: Der Nutzer gab "weiter mit der nächsten Stufe" ohne explizite Stil-Wahl; umgesetzt wurde die in #2849 dokumentierte Empfehlung Funke/Flamme. Die Figur ist als austauschbare SVG-Komponente (`LernfunkeFigure`) gekapselt - ein Stilwechsel (Roboter/Tier) ersetzt eine Datei, Posen-API und Hook bleiben.
- Konservative Annahme: Der Intensitäts-Floor überschreibt auch eine bewusst gewählte "dezent"-Einstellung, solange der Spielmodus an ist - der Modus ist Opt-in und seine Beschreibung benennt genau das; reduced-motion bleibt als Barrierefreiheits-Override unangetastet.
- Konservative Annahme: Der Sound bleibt vom Spielmodus unberührt (weiter eigenes Opt-in, Default aus) - ein Modus-Toggle, der ungefragt Ton einschaltet, wäre invasiv.
- Evidenzbasiert entschieden: localStorage-Pref statt `IStorageService`/UserSettings (etablierte Konvention für Lern-Prefs: `lessonModePref`, `feedbackPref`, `gamificationPref`); Banner-Gestaltung nach dem `TestModeBanner`-Muster; Hinweis nur auf dem ersten Schritt, damit er nicht durch die Lektion nagt.
- Prozessnotiz: PR-Scope-Regel #2578 (Übersetzungen zuerst als eigener PR) kollidiert mit der Dispatch-Vorgabe, ausschließlich auf `claude/spielmodus-gamification-9d8311` zu pushen - gelöst als eigener i18n-Commit VOR dem Feature-Commit im selben PR.
