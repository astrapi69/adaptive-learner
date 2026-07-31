# Chat-Journal 2026-07-31 — Issue-Sichtung, Entscheidungsumsetzung, Blöcke A bis C

Spur: Release-/Gate-Lane (parallel zur Workflow-Audit-Spur, siehe
chat-journal-session-2026-07-31-workflow-audit.md). Lane-Ownership beachtet:
Content-Familie und Engine-Koordination nur gesichtet, nicht angefasst.

## 1. Sichtung aller offenen Vorgänge (09:10)

- Original prompt: CC-Prompt "Alle offenen Vorgänge sichten, dann in Blöcken abarbeiten"
- Ziel: 33 offene Issues + 1 offener PR klassifizieren; nur eindeutige Fälle schließen
- Ergebnis: Tabelle mit 7 Klassen; 4 Schließungen mit Beleg:
  - #2197, #2198 — Fixes `8ad1772d` / `2da6cd7d` als Ancestor von v2.8.2 verifiziert, Release published
  - #2170 — Option A umgesetzt (Skip-Budget + Gate existieren), Restarbeit trägt #2177
  - #2109 — Resolution-Fix PR #2115 gemergt, Build-vs-Pull in #2110 entschieden (Image-Mode)
- Blockvorschlag A bis F, geschnitten nach gemeinsamen Dateien

## 2. Entscheidungsumsetzung (09:20)

Vier RM-Entscheidungen umgesetzt:

- **#2188** (retired_ids): Entscheidung dokumentiert — archivieren, aus SRS-Planung
  und Fälligkeitszahlen nehmen, einmalige Meldung mit Zahl. Issue bleibt als
  Implementierungsauftrag offen; Engine-Spur im Kommentar informiert.
- **#2138** (driftende Orakel): radon gepinnt (RADON_PIN=6.0.1, Gate verweigert
  fremde Version, fail closed), Bau-Orakel bewusst ungepinnt; Begründungen neben
  allen drei Baselines festgehalten. PR #2226, RED-first (Shim-radon 9.9.9).
- **#2104** (PyPI-Wrapper): geschlossen mit ausdrücklichem Wiedereröffnungs-Auslöser
  (negativer OS-Blockierungstest der Binaries auf macOS/Windows).
- **#2107** (Alt-Engine dockerfile-Modus): Bedingung geprüft — die Doku behauptet
  nirgends Alt-Engine-Tauglichkeit (launcher.md formuliert den Kenntnisstand
  ehrlich); geschlossen.

Zusätzlich: #2222 angelegt (GHCR :2.8.1-Löschung, Auslöser delete:packages-Token);
#2130 mit dem eingetretenen Auslöser vermerkt (engine#90/#91 existieren).

## 3. Block A — Gate-Hygiene (09:35)

- **#2217** (PR #2228): verify_docs_hygiene.py enumeriert über den Git-Index
  (`git ls-files --cached`) statt über das Dateisystem; unlesbarer Index = fail
  closed; Scope-Zeile benennt die Messquelle. Realwelt-Beweis: Haupt-Checkout mit
  10 gitignorierten Reports — altes Skript 230/rot, neues 226/grün = CI-Wert.
  Test-Bäume sind jetzt echte Git-Repos.
- Baseline-Lock-in 229 auf 226 war bereits durch die andere Spur erledigt
  (#2219 / PR #2220); Rückmerge #2218 war um 07:26 gemergt — ein versehentlich
  wiederbelebter toter Branch wurde entfernt.
- Semantischer Merge mit der parallel gelandeten #2230-Auto-Lower-Änderung von
  Hand aufgelöst (beide Spuren änderten dasselbe Skript am selben Tag): Index-
  Enumeration + Auto-Lower vereint, deren Tests bekamen den nötigen Staging-Schritt.

## 4. Block B — Release-Automation (09:50)

- **#2179** (PR #2233): neue Single Source scripts/version_display_sites.py;
  sync_versions schreibt die 4 Anzeige-Stellen bei jedem Bump mit und weist die
  geprüfte Menge aus; verify_docs konsumiert dieselbe Liste (schließt die
  README-de-Lücke). 6 Tests, Fünf-Punkte-Vertrag.
- **#2035** (PR #2234): safe.directory-Step im release-prepare-Root-Gate.
- **#2187** (PR #2236, Refs): Publish-Chain idempotent — existierendes Tag wird
  anonym erkannt, Build übersprungen, nur re-verifiziert (Digest aus der
  Registry); 5xx/Netz = fail closed. Vorab real gegen GHCR geprobt. Drei
  Teilentscheidungen ans Issue vorgelegt (Trigger-Reaktivierung, Digest-
  Aufzeichnungsort, Launcher-Cleanup).

## 5. Block C — Docker und Launcher (10:00)

- **#2034** (PR #2238): Compose-Image versioniert getaggt + OCI-Labels; Default
  gehört sync-versions (neuer compose_version_default-Handler, fail closed).
  Folgefix im selben PR: docker-build-smoke liest den Image-Namen aus
  `docker compose config` statt hart (der Verbraucher war gestrandet, das
  Size-Gate hatte korrekt fail-closed zugeschlagen).
- **#2121** (PR #2239): launcher.example.json mit -local-Isolation, per Test
  gegen die ausgelieferte launcher.json gepinnt, keine Versionsliterale erlaubt.
- **#2122** (PR #2243): container_name und Image-Name env-parametrisiert mit
  stabilen Defaults; ohne env byte-identisch zu vorher. Launcher-Test
  (Literal-Match auf die Compose-Zeile) auf die Interpolationsform nachgezogen —
  dieselbe Verbraucher-Klasse wie beim Smoke.

## 6. Zusatzaufträge während der Session

- **release-prepare-Gate** (Auftrag "wf Release — prepare (gate)"): dreimal von
  develop mit 2.8.2 dispatcht. Lauf 1 (30615934532): der #2035-dubious-ownership-
  Punkt ist ÜBERWUNDEN — Fix real bewiesen; dafür nächste latente Schicht:
  verify_image_size.py crashte ohne docker-Binary mit rohem Traceback
  (#2241, Fix PR #2242). Lauf 2 (30617839326): der neue Test selbst scheiterte im
  Container (env komplett ersetzt, Interpreter starb an fehlendem
  LD_LIBRARY_PATH, rc 127) — #2241 wieder geöffnet, Fix PR #2244 (nur PATH
  schrumpft). Lauf 3: siehe Abschlusszeile unten.
- **visual-baseline-sync** (Auftrag "seit langem nicht gelaufen"): kein Defekt —
  On-Demand-Werkzeug (Label/Dispatch), letzte echte Läufe 24.07 beide grün,
  seither trug kein PR das Trigger-Label; das tägliche visual-regression-Oracle
  ist durchgehend grün (zuletzt 31.07 06:36), also kein Baseline-Drift. Kein
  Issue angelegt (Prämisse hielt nicht).

## 7. Merge-Disziplin (Rennen zweier Spuren)

- Auto-Merge im Repo deaktiviert, gh ohne `pr update-branch` (REST-Endpoint
  genutzt), strict=true ohne Merge-Queue: jeder develop-Merge macht die übrigen
  PRs BEHIND. Sequenzieller Merge-Train (Skript: update, auf grün warten,
  squash-mergen, BEHIND-Retry) statt Admin-Bypass — der #2182-Geist gilt.
- cwd-Falle einmal erwischt (Commit lief im Haupt-Checkout ins Leere, Haupt-
  Checkout war sauber, im Worktree nachgeholt) — bestätigt die bestehende
  Memory-Regel, kein neuer Schaden.

## Statistik

- Issues: 33 gesichtet; 6 geschlossen (#2197 #2198 #2170 #2109 #2104 #2107),
  6 weitere über gemergte PRs geschlossen (#2138 #2179 #2035 #2034 #2121 #2122,
  plus #2217 via #2228; #2241 nach Wiedereröffnung via #2244), 2 angelegt
  (#2222, #2241), Entscheidungs-/Auslöser-Vermerke auf #2188 #2130 #2187.
- PRs dieser Spur: 10 gemergt (#2226 #2228 #2233 #2234 #2236 #2238 #2239 #2242
  #2243 #2244), 0 offen zurückgelassen.
- Regeln eingehalten: je PR ein Concern, TDD RED-first (wo Logik), Worktrees,
  keine Admin-Merges, Belege in jedem Close.

## Abschluss

Beweislauf 3 des release-prepare-Gates (Lauf 30618928295, von develop mit
2.8.2): **SUCCESS** — der erste grüne Lauf dieses Workflows seit v2.4.0
(18.07.) und der erste überhaupt außerhalb eines Release-Schnitts. Die Kette
#2035 (safe.directory) + #2241 (Skript fail-closed ohne docker) + #2244
(Test-Umgebung) ist damit am echten Artefakt bewiesen, nicht nur lokal.
