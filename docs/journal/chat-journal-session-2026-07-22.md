# Chat-Journal — Session 2026-07-22

Thema: #1927 — Datei-Upload fuer den Buchtext-Pfad des Create-Lesson-Wizards
(Phase 1 Design, Phase 2a EPUB/TXT/MD, Phase 2b DOCX), plus zwei
CI-Unblocker.

## 1. Phase 1: Verify-First + Design (Vormittag)

- Original prompt: CCW-Auftrag "Datei-Upload fuer 'Lektion aus Text
  erstellen' - Phase 1 (Verify-First + Design)", mit fuenf bindenden
  Design-Grundsaetzen (ergaenzen statt ersetzen, clientseitig, Kapitel-
  Auswahl, Rechte-Hinweis, Groessenlimits).
- Ziel: Machbarkeit DOCX/EPUB pruefen, Kapitel-Erkennung + UI + Limits
  entwerfen, Aufwand schaetzen. Keine Implementierung.
- Ergebnis: Praemissen-Korrektur (mammoth.js ist NICHT im Projekt) und
  der Kernbefund: EPUB und DOCX sind beide ZIP+XML-Container - jszip
  (vorhanden) + nativer DOMParser reichen fuer beide, null neue
  Dependencies. Wichtigster Einzelfund: mammoths Default-Style-Map
  matcht englische Style-Namen, deutsche Word-Dateien tragen
  `berschrift1` - `w:outlineLvl` ist das locale-unabhaengige Signal.
  Gestaffelte Lieferung vorgeschlagen (EPUB zuerst, DOCX danach).
  Aster entschied alle fuenf offenen Designfragen wie empfohlen.

## 2. Phase 2a: Infra + EPUB + TXT/Markdown (PR #1930)

- Ziel: Upload-Button + Kapitel-Picker, EPUB/TXT/MD-Parser, Limits,
  i18n, Testplan, E2E.
- Ergebnis: Spike zuerst (happy-dom DOMParser kann Namespaces +
  `w:`-Praefixe + XHTML, Parser-Tests laufen in Vitest). Dann TDD:
  `lib/content/book-upload/` (epub-parser mit Spine + nav/ncx-Titeln,
  text-parser mit adaptivem ATX-Split, Dispatcher, Limits 20 MiB /
  50k hart / 15k soft), `BookFileUpload` (natives Select statt
  Radix-Portal - happy-dom-Testbarkeit, 100+ Spine-Eintraege),
  ConfirmDialog vorm Ersetzen, 15 neue i18n-Keys + Rechte-Hinweis-
  Reword in allen 11 Katalogen, Testplan DE+EN, Dexie-E2E-Spec.
  Dirsize-Gate kippte (16/15) - Buch-Concern nach
  `create-lesson/book/` gruppiert statt gewhitelistet.
- Commits: a5acf901 (Feature), 8229294d (Complexity-Refactor,
  parseEpub cc 27 -> dekomponiert in readOpf/readManifest/
  readSpineItemText/firstHeading/collectSections). PR #1930 gemerged.

## 3. CI-Unblocker: pyasn1-CVEs (Issue #1931, PR #1932)

- Original prompt: "checks failing".
- Ergebnis: Zwei getrennte Ursachen. (1) Complexity-Gate: eigener
  Code, gefixt per Refactor (oben). (2) pip-audit: pyasn1 0.6.3 mit
  CVE-2026-59885 + CVE-2026-59886 - vorbestehend, traf jeden PR.
  Eigener Concern: Issue #1931, Lock-Bump 0.6.4 in backend UND
  ai-gemini-Plugin (two-installation-paths-Regel). Commit 26d92bc7,
  PR #1932 gemerged, #1931 geschlossen.

## 4. Feature-Screenshots (PR #1947)

- Original prompt: Aster lief `make capture-screenshots` - der Katalog
  hatte keinen #1927-Eintrag.
- Ergebnis: Neuer FeatureShot `create-lesson/buch-upload-picker`
  (Desktop + Mobile, `pinTo` auf das Upload-Panel nach abgeschnittenem
  Erstversuch), Katalog-README ergaenzt, beide PNGs einzeln reviewt.
  Die 4 vom Vollllauf regenerierten `answer-toggle`-PNGs blieben
  bewusst draussen (Drift aelteren Ursprungs, menschliche Review
  noetig, #1532). PR #1947.

## 5. Phase 2b: DOCX (PR #1950)

- Original prompt: Go fuer Phase 2b.
- Ergebnis: TDD (10 Tests zuerst, Fixtures als echte In-Test-OOXML-
  Container inkl. `berschrift1`-Fall). `docx-parser.ts`:
  `w:outlineLvl` aus styles.xml je styleId + direkt am Absatz als
  Primaersignal, styleId-Regex-Fallback fuer lokalisierte Namen,
  adaptiver Split, Degradation zu einem Gesamtdokument-Abschnitt bei
  unstylten Dateien. Neuer Fehlercode `invalid_docx` (das exhaustive
  `Record<BookParseErrorCode, string>` erzwang die neue Meldung zur
  Compile-Zeit). Button/Fehlertexte in 11 Katalogen, Testplan-DOCX-
  Fall DE+EN. Gates: Vitest 7627, Backend 1452, tsc/eslint/Build/
  Dirsize/Complexity gruen. PR #1950 gemerged, Issue #1927
  automatisch geschlossen.

## Zusammenfassung

- 4 PRs gemerged: #1930 (Phase 2a), #1932 (pyasn1), #1947
  (Screenshots), #1950 (Phase 2b). 2 Issues geschlossen: #1927, #1931.
- Null neue Dependencies fuer den gesamten Upload-Weg (EPUB, DOCX,
  TXT, MD) - jszip + nativer DOMParser.
- Tests: 44 neue Frontend-Tests ueber die beiden Feature-PRs
  (Parser + Komponente + Dispatcher), Vitest-Gesamtstand 7627.
- Offen fuer Aster: Device-Check der beiden Testplan-Punkte
  (Datei-Upload + DOCX-Upload) und Review der 4 driftenden
  `answer-toggle`-Screenshots im Working tree.
