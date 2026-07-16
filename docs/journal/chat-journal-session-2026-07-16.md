# Chat-Journal — Session 2026-07-16

Fuenf User-gemeldete Bugs in einer Session, jeweils Issue -> Worktree-Branch -> TDD RED-first -> Fix -> PR (one concern, one branch, one PR).

## Zusammenfassung

| Bug | Issue | PR | Status |
|---|---|---|---|
| Geloeschte Sets kehren nach Refresh zurueck | #1709 | #1719 (ersetzt #1711) | offen, alle Gates gruen |
| Konsolen-404 books.yaml | #1712 / content#150 | #1717 (merged) + content#151 | App merged; Content-PR gruen |
| Konsolen-404 content/ | #1713 | #1718 (merged) | Preview live verifiziert (200) |
| Wizard-Strukturcheck ohne Detail | #1722 | #1724 | offen |
| Skip-Link-Label unsichtbar | #1723 | folgt (Visual-Baselines in Arbeit) | Branch gepusht |


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
