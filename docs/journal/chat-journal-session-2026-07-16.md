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

## 9. Release v2.3.0 (Nachmittag)

- Original prompt: "bringen wir ein neues release raus"
- Ziel: v2.3.0 nach release-workflow.md (gitflow, release/2.3.0 von develop).
- SemVer: feat-Commits seit v2.2.0 (#1687 listen-first audio, #1683 difficulty-Prior, #1681 Import/Export-Haertung, #1628/#1644/#1635 Lesson-UX) -> Minor-Bump 2.2.0 -> 2.3.0.
- Ablauf: make release-prepare; Bump backend/pyproject.toml + make sync-versions (19 Dateien); changelog/releases/v2.3.0.md; README/README-de-Badges + Status, CLAUDE.md Current-state, ROADMAP/backlog-Header auf v2.3.0.
- Step 4b Dependency-Check: keine EOL/Security-Red-Flags; anthropic 0.55->0.116 / fastapi 0.136->0.139 sind Major-Klasse (0.x) und gehen in eine eigene Session statt in den Release (Allowlist-Regel, 13 Plugin-Locks Blast-Radius).
- Gate-Rot #1: make release-test scheiterte im zweiten Vitest-Lauf an einer Unhandled Rejection ("window is not defined", ImportDetail.tsx finally setAnalyzing). Root cause (#1739): der Loading-Test laesst runAnalysis auf den Storage-Awaits haengen; nach Testende laeuft die Continuation weiter, waehlt den Provider hinter der Komponenten-Lebenszeit an und die catch/finally-setStates landen im abgerissenen happy-dom. Fix auf release/2.3.0 (P0-Ausnahme der Release-Sperre): Aborted-Bail nach den Storage-Awaits + mountedRef-Guards; RED-first-Regressionstest (Provider-Call nach Unmount = 0). Commit aaff39d7.

- Gate-Rot #2: Vitest-Flake in DashboardFilterBar - die Text-Assertions liefen ausserhalb von waitFor und trafen den Loading-Zustand vor dem Content-Flip. Fix (#1742): Assertions in waitFor gezogen (Loading-Flip-Race geschlossen). Commit c8a5b2ea.
- Gate-Rot #3: sync-schema-check pingpongte - CURRENT_SCHEMA_VERSION lag auf 1.6, aber die engine-generierte quality-rules.json/der Mirror will 1.7 (latent seit dem 0.12.3-Engine-Re-Pin #1678, weil die PR-CI den Mirror-Check nicht faehrt). Fix (#1744): Konstante auf 1.7 + abgeleitete Artefakte regeneriert; der Manifest-schema_version-Default bleibt bewusst auf dem Engine-Default 1.6 entkoppelt. Commit 74b497cf.
- CCW-Uebernahme ab dem Gate: stales frontend/node_modules (learn-content-engine 0.12.0 statt 0.12.3) per bun install behoben -> sync-schema-check gruen. Reines Umgebungs-Provisioning (kein Release-Code): leeres py3.12-Poetry-Env (cryptography/fastapi nachinstalliert), docs-venv ohne PyYAML (docs && poetry install), Sibling ../adaptive-learner-content nachgeklont (Content-Bundling), Playwright-Browser-Rev 1194 statt der von 1.61.1 erwarteten 1228 -> per executablePath /opt/pw-browsers/chromium gefahren (Wegwerf-Override, wieder geloescht).
- Gate-Rot #4 (dexie-smoke, echt): der lokale Container laeuft ~2.5x langsam -> viele Timeout-Flakes lokal (18 Fehler). Autoritativer Abgleich mit der develop-Nightly (offizieller v1.61.1-noble-Container, korrekter Browser, retries): genau 3 echte Fehler, davon 2 deterministisch - content-knowledge.spec.ts erwartet die per Psychology-Extraktion entfernte psychology-Domaene (Content-Repo main = language + software, 28 Sets / 2 Domaenen / 325 Lektionen), + 1 Flake lesson-import-export (my-lesson-Prefix-Overmatch zaehlt Zeilen + Action-Buttons, 14 vs 21). Kein App-Code-Bruch, sondern Cross-Repo-Drift + Test-Flake, vorbestehend auf develop (07-14 gruen, 07-15/07-16 rot, seit die Extraktion landete). Ruecksprache mit Aster (AskUserQuestion) -> "ich fixe die Tests, dann finishe". Fix (#1746/#1747, Commit dcdda600, P0-Release-Blocker): content-knowledge auf die ueberlebende software/App-Tutorial-Domaene umgestellt (adaptive-learner-app-from-de, content-domain-software); my-lesson-Zaehlung auf die Zeilen-Wurzeln (content-my-lessons-list > li) - die Round-trip-Zahl ist beim Zeilen-Zaehlen stabil, also dupliziert Overwrite keine Zeile, es war rein der Selektor. Beide Specs (4 Tests) lokal im echten Browser gruen; autoritativ per workflow_dispatch dexie-smoke + manual-automation auf release/2.3.0 im 1.61.1-Container validiert.
- Abschluss (Merges): make release-finish mergte release/2.3.0 --no-ff nach main (Release-v2.3.0-Merge d7f518059, sauber, da main jetzt Vorfahre ist) und der Back-Merge brachte den 2.3.0-Bump + Changelog + Gate-Fixes nach develop (f791500de). origin/main + origin/develop gepusht. #1739/#1742/#1744/#1746/#1747 durch den develop-Back-Merge (Default-Branch) automatisch geschlossen.
- OFFEN (Session-Policy-Blocker, an Aster uebergeben): der v2.3.0-Tag-Push scheitert im CCR-Git-Relay mit HTTP 403 (Branch-Pushes bypassen die Protection, Tag-Refs nicht; 4 Retries erfolglos, kein Routing-around per README-Regel), und es gibt kein create_release-MCP-Tool / kein gh in der Session. Der annotierte Tag existiert lokal und zeigt auf origin/main-HEAD (d7f518059). Zu erledigen von Aster: `git push origin v2.3.0` (bzw. GitHub-Release aus changelog/releases/v2.3.0.md direkt gegen main-HEAD anlegen -> erzeugt den Tag), dann release/2.3.0 loeschen. Alles andere (Reconciliation, Gates gruen im 1.61.1-Container, main+develop gepusht, Issues geschlossen) ist fertig.
- Gitflow-Divergenz beim release-finish: der Merge release/2.3.0 -> main scheiterte an "refusing to merge unrelated histories" (Shallow-Clone-Falle: git fetch --unshallow behob den fehlenden gemeinsamen Vorfahren). Danach zeigte sich eine echte main/develop-Divergenz - main trug 4 nie nach develop zurueckgemergte Commits nach v2.2.0 (#1650 content-domain-i18n-Labels + Share-Allowlist, #1705/#1708 graded-quiz-demo-Hide = konvergent mit develops #1702/#1706, content-stats-Autoupdate), waehrend release/2.3.0 71 develop-Commits (u.a. die volle EXP-044-global.css-Zerlegung) trug, die main fehlten -> 40+ Merge-Konflikte. Ruecksprache mit Aster (AskUserQuestion) -> "reconcile main->develop first". Analyse: die Konflikte sind Duplikate derselben v2.3.0-Arbeit (main #1650 hat sie teilweise nachgezogen), develop/release ist die kanonische, vollere Fassung; einzig echt main-unique: die content-domain-i18n-Labels (release fehlten sie, verifiziert) + die Share-Allowlist - beide in NICHT-konfligierenden Dateien. Loesung: git merge -X ours origin/main auf develop (develop gewinnt konfligierende Hunks, mains nicht-konfligierende Zusaetze werden automatisch uebernommen) -> exakt 24 Dateien / +141 (i18n-Labels + Share-Allowlist + korrekte README-CONTENT-STATS 325/28/2, KEINE strukturelle Regression). sync-i18n driftfrei, i18n-Parity 51 gruen, 79 Frontend-Tests (i18n+share) gruen. develop gepusht (9d30c93d7), dann develop -> release/2.3.0 gemergt (6013709a6, additiv, konfliktfrei) -> main ist jetzt Vorfahre von release/2.3.0, der release-finish-Merge nach main ist damit sauber. dexie-smoke + manual-automation im 1.61.1-Container auf 6013709a6 erneut gruen validiert.
