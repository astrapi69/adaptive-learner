# Chat-Journal — Session 2026-08-25

## 1. Visual-Pipeline-Sanierung zu Ende gebracht (Vormittag)
- Original prompt: "mach weiter mit: #2704" / "checken: PR 2718" / Folgeaufträge
- Optimized prompt: unverändert gut — Issue-Nummern als Einstieg reichen, die Kette ergab sich aus den Befunden
- Ziel: die seit 20.08. rote Nightly-Visual-Kette schließen
- Ergebnis: fünf Befunde, fünf Fixes, alle gemergt:
  - #2704/PR #2710: `gotoLessonTheory` suchte einen nie existenten Testid (`lesson-theory` statt `lesson-theory-body`) — Surface lief seit Juni als stiller Skip; 3 neue Baselines.
  - #2712/PR #2713: Comparator-Toleranz (1%-Ratio skaliert mit Viewport-Fläche) ließ einen kompletten Zustandswechsel auf Desktop durch (Empty-vs-Active = 15.790 gezählte Pixel < 20.736 Budget); absolutes Cap 2.500 px. RED-Beweis lokal mit restaurierter Alt-Baseline.
  - #2715/PR #2716: Nightly-Gate rendert auf blankem ubuntu-latest, Baselines entstehen im gepinnten Playwright-Container — Umgebungs-Mismatch = Dauerrot seit dem #2695-Resync; Gate containerisiert. First-Run-Proof: 120/15 statt alles-rot.
  - #2717/#2718: die 15 Rest-Stalen waren durch den #2714-Sync schon refresht (PR als superseded geschlossen); #2719/PR #2720: Sync-Änderungserkennung (`git diff`) war blind für untracked Re-Renders nach Löschung — `git status --porcelain`.
  - #2721/PR #2722: der finale Flap (~19k px, wechselnde Themes) war der Motivations-Toast ("Letzte - bring es zu Ende!", autoClose 3000) im Shot-Fenster — Diff-Artefakt zeigte exakt die Toast-Box. Toast-Wait in `settleForScreenshot` (fail-loud), Rasterisierungs-Flags als Härtung, alle 135 Baselines uniform neu. Determinismus-Beweis: zwei Compare-Läufe (32482669682: 134+1 Retry-Flake; 32483355525: 135/135 clean).
- Nebenbei: Dependabot-PR #2708 (kaputter Rebase mit Duplicate-Keys in package.json + korruptem bun.lock) manuell repariert und gemergt; SpeechButton-Orphan (#1485-Rest) rebased/fertiggestellt (PR #2714); Branch-Großputz (4 Remote-, 62 Lokal-Branches, 30 Worktrees inkl. release/2.12.0 nach Back-Merge-Verifikation).

## 2. Regeln: Parametrisierte Tests (Nachmittag)
- Original prompt: "bei den rules fehlen die parametrisierte Tests, thema Quality Checks oder?" → "ja umsetzen" → "dann schreiben wir dort welche…"
- Ziel: Lücke schließen + Referenz + mutationsgetriebene Erweiterung
- Ergebnis: #2739/PR #2740 (quality-checks.md-Abschnitt + tdd.md-Querverweis, Korpus-Raise +984 deklariert); #2744/PR #2745 Referenz-Retrofit (8 `extract_json_object`-Fälle → eine Wertetabelle, 11/11 vorher=nachher); Stamm-Scan: 62 Cluster, Stichprobe zeigt Mehrheit teilt nur Präfix — keine Tranche, Retrofit beim Anfassen. #2746 (SRS-Mutanten) geparkt bei Release-Start: Stryker-Basislauf src/lib/srs 51,5% Score, Quell-Überlebende status 27 / element-attempt 45 / keys 14 / identity 8 / mastery 5 / exam 1; JSON-Report liegt im Worktree wt-2746.
- Drei Lücken aus externer Einschätzung prämissen-geprüft erfasst: #2741 Dead-Code (P3, mit #2486-Vorbedingungen), #2742 Prompt-Templates (P4, docs/prompts existiert bereits teilweise), #2743 AI-Metriken (P5 mit Gegenargument). Effizienz-Vorschläge (Erosion-Schutz vereinfachen, 3 statt 5 Gate-Tests) bewusst NICHT umgesetzt: Abschwächung incident-gedeckter Regeln; Multi-Agent-Parallelität ist hier Realität (Cloud-Session lief heute parallel auf PR #2711).

## 3. Release v2.13.0 (Nachmittag/Abend)
- Original prompt: "Gut erstellen wir ein neues release"
- Ziel: v2.13.0 nach release-workflow.md
- Ergebnis: **v2.13.0 released** (Tag 5a2622a4 auf main, GitHub-Release publiziert).
  - Umfang seit v2.12.0: 71 Commits (9 feat / 28 fix / 10 refactor / 1 perf), 511 Dateien, +15.777/−4.555.
  - Gates (alle in dieser Session gelaufen): make release-test grün (Backend 1786 passed/2 skipped; Vitest 8815/8815 zweimal; dexie-smoke 136; manual-automation 77; docs-drift 0 FAIL/3 WARN; Ratchets grün); Playwright-Smoke **45 passed / 0 silenced** (Budget-Datei max 0); tsc/ruff/mypy/pre-commit-all-files clean; Launcher-PyInstaller grün (2.13.0 embedded); docker-build-smoke grün. Ein Vitest-Flake (lesson-types-source.guard, 8s unter Last direkt nach Node-Modules-Nachinstallation) im Vollauf 8815/8815 nicht reproduziert.
  - Befund unterwegs: lokales Backend-venv stale (fastapi 0.136 installiert vs 0.141 gelockt → 51 Collection-Errors + mypy-Fehlalarm); `poetry install --sync` VOR jeder Grün-Wertung — die dokumentierte Drift-Klasse, diesmal am eigenen Rechner.
  - Workflow-Abweichungen (dokumentiert): (a) Routine-Dep-Bumps übersprungen — alles In-Range-Patch-Tails, #2621-Sweep war 6 Tage alt; nächster Sweep nimmt sie. (b) `make release-publish` erzeugt ohne `--draft`; der Pflicht-Sequenz (v2.8.0 Option 1) folgend Draft manuell erzeugt.
  - Back-Merge: PR #2747 grün gemergt, develop trägt 2.13.0, release-Branch beidseitig weg.
  - Publish-Kette: Erstlauf 32840213174 rot am arm64-Size-Gate in der SCHRUMPF-Richtung (publiziertes arm64 125.675.448 B = 420.128 unter Ceiling−Toleranz; erste ECHTE Publish-Messung nach zwei Schätz-Reseeds). #2748/PR #2749: Ceiling deliberate 126.095.576 → 125.675.448 (CI-Wert aus dem Enforcement-Lauf selbst). Danach #2187-Idempotent-Re-Verify: erster Dispatch korrekt fail-closed (develop-CI lief noch), **Run 32842782189 voll grün** — Digest-Match statt Rebuild, amd64+arm64 Pull/Version/Size/Page-APPEARS.
  - Assets komplett (11): 3 Launcher-Binaries + 3 sha256 (aus den grünen main-Builds des Tag-Commits 328396627{84,00,29}, Checksummen lokal verifiziert), 2 Arch-Archive + 2 sha256 (lokal `docker save --platform`; erster Versuch ohne `--platform` ergab 226-MB-Doppel-Export unter containerd-Store — der v2.11-Merkposten bestätigt), image-digest.txt. Erst nach Checkpoint sichtbar geschaltet.
- Commits: 61dc8db5 (Bump+Changelog, Gate-Evidenz im Body), 5a2622a4 (Release-Merge/Tag), 01df1e0a (#2749 Ceiling), dieser Doku-PR.

## Fragen und Annahmen
- Angenommen (konservativ): der einmalige Vitest-Flake unter Install-Last ist kein Regressionssignal — Vollauf-Grün 8815/8815 als Beleg; kein Issue, da nicht reproduzierbar (stale-vs-flaky-Diagnose: schnell + einmalig + lastkorreliert).
- Evidenzbasiert entschieden: arm64-Ceiling-Senkung aus dem Publish-Lauf selbst statt image-size-measure.yml — der Enforcement-Lauf IST die maßgebliche Umgebung (Baseline-Notiz `_arm64_lower_2748`).
- Blocked/Upstream gelesen: kein Eintrag durch das v2.13.0-Tag getriggert (DEP-TS7 wartet weiter auf typescript-eslint-Peer).

## Statistik der Session
- 12 PRs gemergt (#2710 #2713 #2714 #2716 #2720 #2722 #2740 #2745 #2747 #2749 + #2708-Reparatur + dieser), 1 PR superseded geschlossen (#2718).
- 10 Issues geschlossen (#2704 #2712 #2715 #2717 #2719 #2721 #2739 #2744 #2748 + #2703 via Cloud-PR #2711), 5 neue offen (#2741 #2742 #2743 #2746 + —).
- Release v2.13.0 vollständig durch alle Pflicht-Gates.

## AI-Metriken (#2743)
- aufgaben: 12
- direkt-gruen: 7
- korrektur-runden: 7
- praemissen-korrekturen: 3
