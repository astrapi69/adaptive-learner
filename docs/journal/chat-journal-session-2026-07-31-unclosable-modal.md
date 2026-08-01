# Chat-Journal: Nicht schließbarer Dialog (Abdeckungsfrage statt Einzelfix)

Datum: 2026-07-31

## 1. Befund und Ursache (Verify-First)

- Original-Prompt: CCW "Nicht schließbarer Dialog" - ein modales Fenster mit
  Release- und Installationshinweisen lässt sich nicht schließen; als
  Abdeckungsfrage behandeln, nicht als Einzelfix. Zeichen-/Sprachbefund
  desselben Fensters ist eine andere Spur.
- Ziel: Ursache belegen, den Dialog schließbar machen, alle modalen Fenster
  aufzählen und die Auswege per Prüfung absichern.
- Ergebnis: Das "Was ist neu"-Fenster ist `DesktopUpdateHost` (API-/Desktop-
  Modus, #840). Es nutzte das rohe `.modal-overlay`/`.modal-card`-Markup statt
  des kanonischen `ModalShell`. Die Hypothese aus dem Prompt bestätigt sich:
  `.modal-card` bekommt `max-height` + `overflow-y` NUR in
  `@media (max-width: 768px)` (styles/legacy/24-lesson-mode-nav.css:365); die
  Basisregel (styles/legacy/08-qr-scanner.css:393) hat auf dem Desktop keine
  Höhenbegrenzung und keinen Scroll. Das Overlay ist `position: fixed;
  inset: 0` ohne eigenen Scroll, der "Schließen"-Knopf sitzt in einer unteren
  `.form-actions`-Zeile - bei langen Hinweisen (das Fenster setzt
  `limit = RELEASE_NOTES_LIMIT * 8` = 4000 Zeichen) rutscht er unter die Falz.
  Kein Escape-Handler, kein Hintergrund-Klick. Genau die #937-Klasse
  (AiValidationDialog), die `ModalShell` einführte - hier als Rückfall wieder
  aufgetreten. Klasse wiedereröffnet, nicht nur die Instanz.

## 2. Fix + Abdeckungsprüfung (TDD, RED-first)

- Issue #2266 zuerst (GITHUB-ISSUE-PFLICHT).
- RED: 5 Verhaltenstests an `DesktopUpdateHost.test.tsx` (X, Escape,
  Hintergrund, Klick-innen-schließt-nicht, scrollbarer Body) + neue
  `shared/feedback/modal-exit-coverage.test.ts` (roher Satz 15 > Baseline 14).
  7 rote Tests belegt.
- GREEN: `DesktopUpdateHost` auf `ModalShell` umgestellt (fester Kopf mit
  stets sichtbarem X, scrollbarer Body, Escape, Hintergrund, Fokusrückgabe).
  Innere Testids erhalten (`desktop-update-modal[-release|-close]`).
- Barrierefreiheit: `ModalShell` um `useDialogFocus` erweitert - Fokus wandert
  beim Öffnen in den Dialog, Tab-Falle, Rückgabe beim Schließen. Kommt allen
  fünf ModalShell-Verbrauchern zugute. 3 Fokustests ergänzt.
- Abdeckungsprüfung `modal-exit-coverage.test.ts`: zählt jedes modale Fenster
  unter `src/` (39 Dateien) und schlägt fehl, wenn ein neues nicht in
  `MODAL_REGISTRY` steht, wenn der rohe `.modal-overlay`-Satz falsch etikettiert
  ist, oder wenn er über die Baseline wächst (Ratchet, nur schrumpfend; 15 ->
  14 durch diesen Fix). Muster wie bei den Elementmengen. Als Vitest-Test in
  `make test` / ci.yml verdrahtet - kein neuer Workflow, keine gates.yaml-Pflege.

## 3. Aufzählung der modalen Fenster (Ergebnis je Klasse)

39 modaltragende Dateien, klassifiziert im Registry:
- `shell-frame` (6): eigene Auswegtests (ModalShell, ConfirmDialog,
  ShortcutHelpDialog, QrCodeModal, AvatarPreviewDialog, ImageCropDialog).
- `modalshell` (5): AiValidationDialog, QualityCheckDialog, ShareAsRepoButton,
  MigrationWelcomeDialog, DesktopUpdateHost (neu).
- `radix` (4): BadgeGallery, ShareWizard, HelpDrawer, LessonExitDialog.
- `confirm` (7): BookFileUpload, OrphanedDataSection, RemoveRepoDialog,
  ConfirmContext, Content, GlobalShortcuts, AvatarUpload.
- `custom` (3): QRScannerModal, SyncConflictDialog, NavXpBadge - je mit
  eigenem Escape + Hintergrund/Außenklick.
- `raw` (14): der Ratchet-Satz roher `.modal-overlay`-Dialoge; Migration zu
  einer Shell ist die Folgearbeit (nicht in diesem PR, je eigener Belang).

## 4. Sprachmischung / Zuständigkeit

- Zeichen- und Sprachbefunde desselben Fensters sind laut Prompt anderweitig
  beauftragt - nicht angefasst. Der Release-Notiztext selbst (`ReleaseNotes.tsx`)
  bleibt unberührt; nur der Fensterrahmen wurde getauscht.
- Zweite Spur: offener PR #2264 (e2e cache dir) - keine Dateiüberschneidung.

## 5. Verifikation

- `bunx tsc --noEmit` sauber; ESLint sauber; betroffene Vitest-Bereiche grün
  (ModalShell + alle Verbraucher 77/77; breiter Sweep shared/a11y/contexts
  318/318).
- TESTPLAN-PFLICHT: `docs/manual-tests/testplan-adaptive-learner.md` (+ `-en`)
  um einen Abschnitt mit iOS-Standalone-Punkt erweitert (neuer deutscher Text
  mit echten Umlauten).
