**Adaptive Learner Vorgehensweise (etabliert, Sessions 1-4)**

## Rollen
- **Aster:** Architekt, manuelles Testen, Geraeteverifikation, Entscheidungen, Human-in-the-Loop
- **Sparring Partner (ich):** Prompts schreiben, Agenten koordinieren, Architektur-Beratung
- **CCW:** Frontend, Features, E2E, Visual Regression, Doku (Claude Code Web)
- **CC:** Backend, Infra, Launcher, Doku (Claude Code lokal)
- **CCWc:** Content-Repository-Agent (Lektionen, Sets, search-index.json)

## Workflow

**1. Finding -> Prompt -> Fix -> Weiter**
Kein Debattieren, kein Ueberanalysieren. Root Cause zuerst, dann machen.

**2. Issue-First (GITHUB-ISSUE-PFLICHT)**
GitHub Issue vor jedem Code. `gh issue list --search` fuer Duplikate. Related-to Referenzen. Gilt fuer alle Agenten (CC, CCW, CCWc). ISSUE-LIFECYCLE: Closes/Related im Commit. Bei Sub-Aufgaben Sub-Issue statt Umbrella-Issue (SUB-ISSUE-CLOSES).

**3. Autonomie-Direktive**
Keine Rueckfragen, keine Zwischenstopps. Alle Schritte in einem Pass. Entscheidungen auf Basis der Projektarchitektur, nicht durch Fragen. Testfehler autonom fixen, bevor gestoppt wird. Commits in logischen Bloecken, Endbericht am Schluss. Stopp nur bei kritischen, unloesbaren Blockern. Proaktive Prompt-Kettung.

**4. PR-Target: develop (NICHT main!)**
Gitflow Pflicht. `develop` ist Default-Branch und Integrationsziel. `main` NUR fuer Releases. Production deployt aus `main`, Preview/Staging aus `develop`. Release-Sperre: kein Code nach `develop`, wenn ein Release-Branch offen ist. No-Amend auf offenen PRs.

**5. Library-First 4-Stufen**
Native Language APIs -> Framework -> Library -> Selbst bauen (letzter Ausweg). Vor jedem Custom-Build pruefen, ob eine bestehende Loesung existiert.

**6. Verify-First**
Vor jeder Implementierung pruefen, ob es schon existiert. Bestehende Infrastruktur wiederverwenden statt duplizieren. Keine neuen Repos/Frameworks ohne Not.

**7. Half-Wired verboten**
Nie halb verdrahtete Features shippen. Entweder komplett oder gar nicht.

**8. Root Cause vor Fix**
Agenten neigen dazu, Fixes zu erfinden ohne die Ursache zu verstehen. Ehrliche Triage zuerst. Kein kosmetischer Fix ueber einem ungeklaerten Defekt.

**9. Prio-Reihenfolge**
PRs > Bugs > Infra > UI/UX > Cleanup > Features > Release.
P0 (Blocker) -> P1 (Bugs) -> P2 (BF/UK) -> P3 (Nice-to-have) -> P4 (Vision). Keine Diskussion, zuweisen.

**10. Prompts sofort liefern**
Wenn die Richtung klar ist: Prompt schreiben, nicht fragen. Entscheidungsfragen koennen danach geklaert werden.

**11. Kein Wunschkonzert**
Aster bestimmt den naechsten Task nach Prio und weist direkt zu. Nicht "was soll X machen?" fragen.

**12. EXP-Dokumente fuer Entscheidungen**
Jede signifikante Feature-/Architektur-Entscheidung bekommt ein nummeriertes EXP-Dokument (aktuell 34+). Design vor Code.

## Architektur-Regeln (AL-spezifisch)

- **DESIGN-TOKEN-ARCHITECTURE:** CSS-Variablen plus token-backed Tailwind. Keine Inline-Styles, keine Fixed-Palette, keine externen CSS-Module. `no-hardcoded-colors`-Guard.
- **TAILWIND-ONLY:** Styling ausschliesslich ueber Tailwind-Utilities.
- **DEXIE-MODE-REGEL:** App laeuft in zwei Storage-Modi (API + Dexie/IndexedDB). Beide Modi muessen jede Aenderung tragen.
- **SYNC-UI-GATE:** Sync-Funktionen im Dexie-Modus ausgeblendet.
- **FUNKTION-NICHT-VERFUEGBAR:** Nicht verfuegbare Funktionen ausblenden, nicht ausgrauen (kein Graying-out).
- **IStorageService Seam + guardedFetch:** Storage-Zugriff ueber das Seam, nicht direkt.
- **Repository Pattern** im Service-Layer. God-File-/God-Folder-Eliminierung laufend (aktuell 0/0, baselined).
- **PluginForge/pluggy Hook-Architektur** fuer alle neuen Backend-Module.
- **R-M-W-Disziplin:** atomare Dexie-Operationen (`db.transaction("rw")`, `table.modify()`), kein ungeschuetztes get-spread-put. Unique Constraints auf user-skalierte Tabellen.
- **44px Touch Targets**, Barrel Exports (index.ts als Modul-API), `shared/` fuer wiederverwendbare Komponenten.

## Quality Gates

- **tsc + Vitest gruen nach JEDEM Commit.**
- **Explicit `git add [paths]`** (kein `-A`). `git status` vor jedem Commit.
- **Kein `Co-Authored-By`.**
- **i18n: alle 11 Kataloge** (UI-Sprachen). Alle sichtbaren Strings ueber die Uebersetzungsschicht, keine Hardcodes. Source of Truth sind die Backend-YAMLs, gespiegelt via `make sync-i18n`.
- **Echte UTF-8-Umlaute** (oe/ue/ae VERBOTEN als Ersatz). ae/oe/ue nur historisch in Launcher-Kontext, in AL immer echte Umlaute.
- **Ratchet-Guards:** Kohaesions-Watcher (WARN >500, ERROR >1000), File-Size-Baseline, Complexity-Gate (radon E/F, ESLint cx >20). madge 0 Zyklen.
- **Test Impact Analysis:** `vitest --changed` und `pytest --testmon` auf PRs. Volle Suite (5758+ FE, 1200+ BE) nachts plus bei Release.
- **CI-Nachtschicht:** Security-Scan (pip-audit, npm audit, bandit), Coverage, Dexie-Smoke, Complexity-Report nachts. Auf PRs nur Korrektheit.
- **axe-core a11y** plus ESLint bei 0 Warnings.

## Visual-Nachweis (zwei getrennte Mechanismen, beide Pflicht bei UI)

**A. Visual Regression (automatisiert):**
Playwright Visual Regression mit 60 Baselines. Bei UI-Aenderung Baseline aktualisieren via `make capture-screenshots` in maschinen-konsistenter Umgebung (nicht im fluechtigen Container).

**B. Visual-Device-Check (manuell, nur Aster):**
Agenten koennen keine Browser oeffnen. Jedes sichtbare/interaktive Feature wird VOR dem Merge manuell auf echtem Geraet geprueft: iPhone plus Desktop-Chrome/Brave. "CI gruen heisst nicht Browser gruen" ist wiederholt eingetreten. Dieses Gate ist nicht durch automatisierte Screenshots ersetzbar.

## Release-Gates (vor jedem Tag)

- **BACKUP-AKZEPTANZTEST (manuell, nur Aster):** echter Round-Trip-Beweis (Backup erstellen -> Browser-Daten komplett loeschen -> Wiederherstellen -> Sets/Fortschritt/Settings/Theme pruefen, inkl. Cross-Mode GH-Pages -> Lokal) VOR backup-bezogenen Merges und vor Release.
- **E2E Smoke gruen** vor Release-Tag.
- **Visual-Device-Check** der release-relevanten UI-Features.
- Release-Reihenfolge: alle Agenten-PRs gemergt -> Gates bestanden -> `release/x.y.z` schneiden (`make release-prepare` -> Changelog -> `release-test` -> `release-finish`).

## Plattform-Risiken (im Blick behalten)

- **iOS WKWebView:** IndexedDB kann unter Storage-Druck evakuiert werden. Mitigation: bestehender Export (Anki, Markdown, PDF).
- **PWA-first, keine Migration:** Capacitor/React Native/Kotlin sind NICHT der Weg. Bestehende PWA haerten.

## Kommunikation

- Deutsch mit Aster.
- Englische Prompts an Agenten (echte UTF-8-Umlaute).
- Keine Em-Dashes, kein Hedging, keine Verbositaet.
- Direkt, pragmatisch, keine Energie-Warnungen.
- Terse Direktiven ("ja", "go", "weiter" = fortfahren).
- Abkuerzungen: S=Settings, UK=UX/UI-Konform, BF=Benutzerfreundlich, CLC=Clean Code, CC/CCW/CCWc fuer Agenten.

## Staged Launch (Disziplin)

Warm Audience (Medium + Facebook) -> Closed Beta (5-10 Tester + Native-Speaker-Content-Review) -> Reddit Soft-Launch -> Show HN (nach ausreichender Soak-Zeit). Unverifizierte Sprachsets (JA/KO/ZH) bis zum Native-Speaker-Review aus allen oeffentlichen Pitches ausgeschlossen. Testzahlen allein sind kein Stabilitaetsbeweis.
