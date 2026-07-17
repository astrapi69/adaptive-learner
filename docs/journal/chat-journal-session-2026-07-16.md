# Chat-Journal — Session 2026-07-16

Fuenf User-gemeldete Bugs in einer Session, jeweils Issue -> Worktree-Branch -> TDD RED-first -> Fix -> PR (one concern, one branch, one PR).

## Zusammenfassung

| Bug | Issue | PR | Status |
|---|---|---|---|
| Geloeschte Sets kehren nach Refresh zurueck | #1709 | #1719 (ersetzt #1711) | offen, alle Gates gruen |
| Konsolen-404 books.yaml | #1712 / content#150 | #1717 (merged) + content#151 (merged) | End-to-end live: Registry-Flags auf main verifiziert |
| Konsolen-404 content/ | #1713 | #1718 (merged) | Preview live verifiziert (200) |
| Wizard-Strukturcheck ohne Detail | #1722 | #1724 | offen, alle Checks gruen |
| Skip-Link-Label unsichtbar | #1723 | #1727 | offen, visual-baselines-unaffected (Branch-vs-Kontroll-Lauf: 0 echte Diffs, nur Header-Autohide-Flake in lesson-matching-graphite) |


## 1. Geloeschte Inhalte kommen nach "Aktualisieren" zurueck (#1709 -> PR #1711)

- Original prompt: CC-Prompt "Geloeschte Inhalte kommen nach Aktualisieren zurueck" (Meine Inhalte, Refresh restauriert geloeschte Sets).
- Goal: Loeschzustand persistieren; Refresh darf bewusste Loeschung nicht rueckgaengig machen, Sync-Zweck (neue Sets) erhalten.
- Root cause: /content laedt via listSets() den vollen Quell-Katalog (bundled + Repo-Manifeste); Delete purgt nur den Cache + optimistischen State. Kein persistierter "explizit geloescht"-Zustand; der #772-Kommentar ("only locally downloaded") war nie durch einen Filter gedeckt. Bundled Sets (Assets im Build) waren dadurch UNLOESCHBAR.
- Fix: neues Modul lib/content/repos/dismissed-sets (localStorage, source::id-Keys, Dexie-userData-Mirror #791, MANAGED_USER_DATA_KEYS). loadSets filtert dismissed+uncached; cached gewinnt immer (Re-Download belebt); /discover listet dismissed weiter. Dismissal bei Einzel-/Bulk-Delete + Discover-Remove; Undismiss bei jedem Download (Row-Action, Discover, DeepLink).
- Tests: TDD RED-first (Modul 6, Data-Hook-Repro 4, Action-Hook 4, Key-Pin 1) + e2e/dexie/content-delete-refresh.spec.ts. Volle Vitest-Suite 673 Dateien / 7013 gruen, tsc + ESLint clean.
- Commit/PR: PR #1719 (ersetzt #1711 - Branch war versehentlich von main abgezweigt), Issue #1709.

## 2. Konsolen-404 books.yaml (#1712 -> PR #1717 + content#150/#151)

- Root cause: books.yaml wurde im Foederations-Refactor content#149 BEWUSST aus dem offiziellen Repo geloescht (ai-Sektion nach alc-ai; psychology vorher nach alc-psychology); die App fetcht die Root-URL aber bedingungslos bei jedem /content-Mount -> garantierter 404, Feature #141 seit 2026-07-15 stumm tot.
- Fix: Registry-getrieben. RecommendedRepo bekommt optionales books:true; fetchBookRecommendations fragt books.yaml NUR bei geflaggten Eintraegen am gepinnten Ref ab (Muster #547: nichts anfragen, was als abwesend bekannt ist), merged Domains, Cache-Fallback unveraendert. Content-Repo: Schema-Erweiterung (additionalProperties-strikt) + Flags fuer alc-ai/alc-psychology (beide shippen books.yaml am Pin, HTTP 200 verifiziert).
- Tests: book-recommendations.test.ts neu (7, RED-first). Volle Suite 7095 gruen.
- Commits/PRs: App PR #1717 (Issue #1712); Content PR #151 (Issue #150, inkl. Schema-Fix nach rotem validate-registry-Gate).

## 3. Konsolen-404 "content/" (#1713 -> PR #1718)

- Root cause (live verifiziert): SPA-Route /content wird auf GH Pages vom ECHTEN Verzeichnis content/ (bundled Assets) beschattet: GET /adaptive-learner/content -> 301 -> /content/ -> 404 (404.html-Fallback, kein index.html im Verzeichnis). Trailing-Slash in "content/:1" = Fingerabdruck des Directory-Redirects; Kontrollroute /dashboard 404t ohne Redirect.
- Fix: deploy-gh-pages.yml + deploy-preview.yml kopieren die SPA-Shell zusaetzlich nach dist/content/index.html (mkdir -p Guard) -> /content/ antwortet 200; gleicher Mechanismus wie das docs/-Subtree.
- Verifikation: LIVE bestaetigt auf dem Preview-Deploy (develop): /content/ -> 200 statt 404 (vorher 404); Produktion folgt mit dem naechsten main-Deploy.
- Commit/PR: PR #1718, Issue #1713.

## Questions and assumptions

- Design "Aktualisieren": gewaehlt wurde die sichere Variante (geloescht bleibt geloescht bis aktiver Re-Download; neue Sets erscheinen weiterhin; kein Auto-Download). Grund: #772-Intention + Selbstheilung (cached gewinnt ueber Dismissal-Record).
- "Meine Inhalte" listet weiterhin auch nie heruntergeladene Katalog-Sets (von e2e content-tree.spec gepinnt); nur explizit geloeschte werden ausgeblendet. Ein weitergehender "nur Downloads"-Umbau waere Produktentscheidung, nicht Bugfix.
- Geraeteverifikation (iPhone/Desktop-Browser) bleibt beim Maintainer; Checkliste steht in PR #1711/#1718.

## 4. Wizard "Gueltige Lektionsstruktur" schlaegt fehl ohne Detail (#1722)

- Root cause (verifiziert): checkDraft (draft-to-lesson.ts) faengt den Fehler von buildLessonFromDraft/validateGeneratedLesson (ajv, Engine-Schema 1.7) mit BARE CATCH -> praezise Meldung (z. B. "/cards/0/back must NOT have fewer than 1 characters") wird zum booleschen X reduziert. Generator-Output ist fuer saubere Daten valide (in-memory-ajv ueber Default-Konfig verifiziert); erreichbare Verletzungen: (a) leere Kartenseite via UNGEGUARDETEM Inline-Edit-Save (Add + CSV sind geguarded), (b) Kartenseite > 500 Zeichen (kein maxLength, kein Clamp). Kein 1.7-Regressions-Schema.
- Fix: checkDraft liefert schemaError (+ console.error); ReviewStep zeigt das Detail unter der X-Zeile (i18n-Key create_lesson.review.structure_error in 11 Katalogen + sync-i18n); CardEditor: Inline-Save-Gate wie Add + maxLength=500 (CARD_SIDE_MAX_LENGTH) auf allen Front/Back-Inputs.
- Tests: RED-first (3 checkDraft-Tests inkl. Repro "alle Counts gruen, Struktur rot", 2 CardEditor-Guard-Tests).

## 5. Skip-Link unsichtbares Label (#1723)

- Root cause (headless reproduziert + Stylesheet-Walk): a:not([data-slot="button"]):not(.btn) { color: var(--accent) } hat durch die :not()-Argumente Spezifitaet (0,2,1) und schlaegt .skip-to-content (0,1,0) -> Label accent-auf-accent = unsichtbarer grosser Pill. KEINE EXP-044-Layer-Regression (Block unlayered, nie gewrappt; #1670 verschob byte-identisch). Spezifitaets-Wettruesten seit #146/#194.
- Fix: Exklusionen in :where() -> (0,0,1); Carve-outs bleiben (schuetzen den layered-utility-Fall), Klassen-Regeln gewinnen wieder normal. contrast.test.ts-Pins aktualisiert (+ kein bare-:not-Regress, + skip-link Farb-Pin); neuer e2e/dexie/skip-link-visible.spec.ts pinnt computed color != background (RED vor Fix, GREEN nach).
- Visual-Baselines: Branch-Lauf vs. develop-KONTROLL-Lauf verglichen (Drift-Isolation wie #1692).

## 6. Visual-Baseline-Isolation (#1727)

- Branch-Lauf 29492359856 vs. develop-Kontroll-Lauf 29493457033, 105 PNGs verglichen: einzige Differenz lesson-matching-graphite.png, Delta = Auto-Hide-Header-Scrollzustand (bekannter Timing-Flake), keinerlei Farb-Deltas. Die :where()-Demotion ist damit empirisch visuell inert; Label visual-baselines-unaffected per REST gesetzt und verifiziert (gh pr edit faellt auf diesem Repo still aus).

## Statistik

- 5 Bugs, 5 Issues (#1709 #1712 #1713 #1722 #1723) + content#150; 6 App-PRs (#1711 ersetzt durch #1719, #1717, #1718, #1724, #1725, #1727) + 1 Content-Repo-PR (#151); 3 davon bereits gemerged.
- Neue Tests: 14 Vitest (dismissed-sets 6, Data-Hook 4, Action-Hook 4) + 8 Vitest (books-Rewrite 7, Key-Pin 1) + 5 Vitest (Wizard 3, CardEditor 2) + aktualisierte contrast-Pins + 2 neue Dexie-E2E-Specs (content-delete-refresh, skip-link-visible).
- Lesson: EnterWorktree-"fresh" zweigte von origin/main ab, PR #1711 wurde DIRTY; als Memory-Regel festgehalten (Worktrees explizit von origin/develop erzeugen und Basis verifizieren).

## 7. P0: develop build-rot durch semantischen Merge-Konflikt (#1729 -> PR #1730)

- #1724 (BOOLEAN_CHECK_KEYS inkl. languagePair) x #1721 (entfernt languagePair-Check, #1715): beide einzeln gruen, der Merge indiziert das Interface mit einem nicht mehr existenten Key -> tsc -b TS7053, develop-CI + jede PR-Merge-Commit-CI rot (zuerst an #1727 sichtbar). Ein-Zeilen-Fix: Key aus BOOLEAN_CHECK_KEYS entfernen.

## 8. Download aus Entdecken unsichtbar in "Meine Inhalte" (#1731 -> PR #1734)

- Root cause: Entdecken bietet die GANZE foederierte Registry an und downloadSetDexie akzeptiert jede Quelle; listSetsDexie iterierte aber NUR konfigurierte Quellen -> Download aus nicht verbundenem Registry-Repo gecacht, aber nie gelistet (Remedy war das manuelle Repo-Verbinden). Das Backend hatte exakt diesen Fix laengst (_all_cached_entries-Sweep) - reine Dexie-Paritaetsluecke. Delete-all NICHT kausal (purgt nur Cache-Rows); #1709-Dismissal NICHT beteiligt (cached gewinnt).
- Fix: Backend-Sweep in listSetsDexie gespiegelt (letzte gecachte Version je (source, set_id), id-level-Dedupe, subsumiert den User-Generated-Anhang). RED-first-Tests + Live-Beweis (echtes nicht verbundenes Registry-Repo alc-die-waehrung-des-geistes -> sofort sichtbar).

## 9. Eigene Lektion bearbeiten (#1740) + Follow-up Set-Zusammenfassen (#1741)

- Auftrag (CCW): zwei fehlende Funktionen fuer "Meine Inhalte" - (1) eine eigene erstellte/importierte Lektion bearbeiten, (2) mehrere eigene Lektionen zu einem Set zusammenfassen. Verify-first ergab, dass Feature 1 vollstaendig eine Session fuellt (Wizard-Vorbefuellung + Theorie-Erhalt + Ueberschreiben/Kopie + SRS + i18n in 11 + Tests), daher Feature 2 bewusst als Follow-up #1741 ausgelagert (Begruendung im Endbericht).
- Verify-first-Erkenntnisse: der Edit-Button existierte bereits in UserSetActions, aber nur fuer domain==="analysis" (Route zur Import-Seite). Der /create-lesson-Wizard haelt Meta+Cards+Exercises im Page-State (Draft nur Meta+Cards), keine :id-Route, keine Vorbefuellung. Entscheidend: ElementError-SRS-Keys sind INHALTS-abgeleitet (element_key = kanonische Antwort/Label/Tiles), LessonProgress ist per {user}#{source}#{setId}#{lesson_filename} gekeyt. Daraus folgt die "elegante" Loesung frei Haus: unveraenderte Karten behalten ihren Key -> Fortschritt bleibt; geaenderte/entfernte Karten verwaisen (orphan-data-dexie raeumt), neue Karten starten leer. Ueberschreiben unter derselben lesson.id (== Dateiname) erhaelt den Lesson-Progress-Row.
- Umsetzung Feature 1:
  - draft-to-lesson.ts: buildLessonFromDraft(input, opts?) mit id-Override + theorySteps-Override; buildUserSetInput(input, lesson, opts?) mit setId- + origin-Override; lessonToDraftInput (Reverse-Mapping Lektion -> Wizard-Draft); preservedTheorySteps (Wizard-Lineage mit theory-intro -> Intro aus Titel/Beschreibung regenerieren + restliche Theorie behalten; importierte Lineage ohne theory-intro -> alle Theorie-Schritte verbatim erhalten, kein Datenverlust).
  - UserSetActions.tsx: Edit-Button fuer ALLE eigenen Lektionen (Komponente rendert ohnehin nur fuer user-generated; Fremd-Repos bleiben read-only).
  - useContentSetActions.handleEditUserSet: Dispatch - analysis -> /import/:convId (unveraendert), sonst -> /create-lesson/edit/:source/:setId.
  - App.tsx: neue Route /create-lesson/edit/:source/:setId (gleiche Komponente).
  - CreateLesson.tsx: editMode via useParams; Ladeeffekt liest listLessons+getLesson+listSets, befuellt vor, merkt EditContext (source/setId/origin/alle Lektionen/editIndex/originalSteps/lessonId); Draft-Restore + Autosave in editMode uebersprungen (kein Clobbern des Draft-Slots); saveLocally ueberschreibt (setId+lessonId+Theorie-Erhalt + Geschwister-Lektionen mitgetragen), saveCopy legt neue nicht-kollidierende ID (nextCopySetId) mit "(copy)"-Titel an; discard raeumt den Draft-Slot in editMode nicht; Lade-/Fehlerzustaende gerendert.
  - ReviewStep.tsx: editMode + onSaveCopy -> primaerer Button "Aenderungen speichern" (Save-Icon) + "Als Kopie speichern" statt "Speichern und teilen", plus Hinweiszeile.
  - i18n: 8 neue Keys (create_lesson.edit_title/edit_load_error/edit_note + save.save_changes/save_copy/copy_suffix/updated/copied) in allen 11 Katalogen, sync-i18n.
- Tests (RED-first): draft-to-lesson (+8: Reverse-Roundtrip, id-Override, Theorie-Regeneration vs. -Erhalt, setId/origin-Override, valider Edit-Rebuild), CreateLesson edit-mode (+5: Vorbefuellung, Ueberschreiben unter selber setId+lessonId, Save-Copy statt Save-Share, Copy unter frischer ID, Ladefehler), useContentSetActions Dispatch (+3), FoldedUserLessons/ImportActionsPanel Edit-fuer-alle (aktualisiert). Alle Vitest der betroffenen Bereiche gruen (459 in content/hooks/pages/lib-content).
- Umgang mit Progress/SRS bei Bearbeitung (Antwort auf Auftrags-Punkt 4): kein manuelles Reconciling noetig - die Inhalts-Keyung von ElementError plus die filename-stabile lesson.id liefern genau "unveraendert behalten / entfernt verwerfen / neu leer" von selbst. Dokumentiert.

## 10. Eigene Lektionen zu einem Set zusammenfassen (#1741)

- Follow-up aus #9 umgesetzt. Auswahl auf SET-Ebene in "Meine Inhalte" (jede Karte ist ohnehin ein user-generated Set): Checkbox-Modus + Combine-Bar, nur eigene Sets (Fremd-Repos erscheinen dort nie).
- Pure Helper combine-lessons.ts: gatherLessons (Reihenfolge erhalten), dedupeLessonIds (kollidierende lessons/{id}.json bekommen -2/-3-Suffix, kein Ueberschreiben), deriveCombinedLanguages (Mehrheits-Sprache/-Niveau + consistent-Flag fuer den Hinweis), uniqueSetId, buildCombinedSetInput (Modus "new": abgeleitete Sprachen + Titel/Beschreibung/Niveau; Modus "existing": bestehende Metadaten behalten, Lektionen anhaengen). Ergebnis ist ein normaler SaveUserSetInput -> laeuft ueber denselben saveUserSet-Pfad -> automatisch export-kompatibel (kein Parallelformat). Round-Trip-Test: buildCombinedSetInput -> buildContentSetZip -> parseImportFile -> identische Lektions-IDs/Karten.
- UI: CombineLessonsDialog (Neues Set: Titel Pflicht, Beschreibung, Niveau-Select CEFR; Bestehendes Set: Dropdown der NICHT ausgewaehlten eigenen Sets; Mixed-Sprachen-Hinweis; a11y: role=dialog, Checkbox-aria-labels, radio-fieldset). useCombineLessons-Hook haelt Auswahl-State + combine-Action (fetchSetLessons je Quelle, buildCombinedSetInput, saveUserSet, reload). MyLessonsSection um Select-Modus + Checkboxen + Combine-Bar erweitert; ImportActionsPanel verdrahtet Hook + Dialog.
- Nicht-destruktiv: Original-Sets bleiben erhalten (Dialog weist darauf hin); Fortschritt der Originale unangetastet, das kombinierte Set ist eine gruppierte Kopie mit frischen Keys.
- i18n: 19 neue Keys content.combine.* in allen 11 Katalogen, sync-i18n.
- Tests (RED-first): combine-lessons (8, inkl. Round-Trip + Dedupe + Mixed-Flag), CombineLessonsDialog (5: new/existing-Decision, Title-Gate, Mixed-Hinweis, no-targets), ImportActionsPanel-Integration (3: Select-Modus, Kombinieren zu neuem Set mit Dedupe, existing deaktiviert wenn alles ausgewaehlt).
- Sprach-/Niveau-Abweichung (Auftrags-Punkt 3): Set uebernimmt den haeufigsten Wert; Abweichungen werden als nicht-blockierender Hinweis angezeigt.
