# Chat-Journal: Workflow-Audit (rote Workflows finden, klären, sichtbar machen)

Datum: 2026-07-31, Session ab ca. 09:15 Uhr

## 1. Bestandsaufnahme aller Workflows (09:15)

- Original-Prompt: CC-Prompt "Rote Workflows finden, klären, sichtbar machen" - Bestandsaufnahme, Klassifikation je rotem Fall, Sichtbarkeit roter Läufe außerhalb von Pull Requests.
- Ziel: Vollständige Zustandsaufnahme, jeden roten Fall klassifizieren und behandeln, einen täglichen Sammellauf bauen.
- Ergebnis: 31 Workflows erfasst (29 dateigestützt aktiv + 2 GitHub-verwaltete Dependabot-Einträge), je Workflow die letzten 5 Läufe, für rote Fälle Historie bis zu 40 Läufe zurück (Content-Stats bis 24.06., Mutation bis 05.07.).

## 2. develop-weites CI-Rot: Umlaut-Ratchet-Gewinn nicht eingerastet (09:20)

- Befund: Seit 06:57 UTC scheiterte JEDER CI-Lauf (PRs und develop-Pushes) im Pre-commit-Job: `FAIL umlaut-ratchet: count fell 229 -> 226 (a gain)`. Der Journal-Commit zur v2.8.2-Umnummerierung entfernte 3 ASCII-Substitute als direkter docs-Push - kein PR-Gate konnte die Baseline-Nachführung im selben Diff verlangen.
- Klassifikation: Echter Befund im Ratchet-Sinn (Gate arbeitet wie spezifiziert, Verbesserung muss eingerastet werden), mechanischer Fix.
- Ergebnis: Issue #2219, PR #2220 (Baseline 229 -> 226, in sauberem Worktree verifiziert), gemergt 07:25 UTC. develop damit entsperrt; Parallel-Lane mergte direkt danach #2218 (Backmerge) und #2221.
- Commit: 323f0a8f (Squash auf develop: 6257b092)

## 3. Content Stats Drift: 6 Nächte rot, fünfte Strähne seit Juni (09:25)

- Befund: Nightly rot seit 26.07. (Läufe 30190834040 bis 30609689365). Ursache: adaptive-learner-content#168 (25.07.) sortierte das Manifest nach Zielgruppen-Relevanz um; die README-Tabelle behielt die historische Reihenfolge. Zählwerte unverändert (325 Lektionen / 28 Sets) - reiner Ordnungsdrift.
- Klassifikation: Echter Befund. Wiederholungsfall: frühere Strähnen 26.-30.06., 04.-07.07., 10.-11.07., 16.-17.07. - jede blieb tagelang unbemerkt, weil nur der Actions-Reiter sie zeigt. Genau die Motivation für Teil 3.
- Ergebnis: Issue #1531 wiedereröffnet (statt Duplikat), PR #2221 (`--write-readme`-Regenerat), von der Parallel-Lane gemergt. Verifikation per Dispatch-Lauf 30614085518: success.

## 4. Mutation (Frontend): jede Nacht am eigenen 120-Minuten-Timeout gestorben (09:30)

- Befund: Seit ENABLE_NIGHTLY_MUTATION aktiv ist (erster ausgeführter Nightly 25.07.), wurde jeder geplante Lauf nach exakt 120 Minuten mit conclusion `cancelled` abgebrochen - ohne Report-Artefakt. Beleg aus Lauf 30518119839: 1/8-Shard = 2809 Mutanten, nach ~1h50m erst 2464/2809 getestet, Rest-Schätzung ~11h. Die #1956-Dimensionierung (Vollumfang ~7h, also 1/8 ~52min) ist real um mehr als Faktor 2 daneben.
- Klassifikation: Werkzeugfehler - das Gate kann sein eigenes Budget nicht einhalten. Zusatzbefund: Für `cancelled` verschickt GitHub keinerlei Fehlbenachrichtigung; diese Klasse war strukturell unsichtbar.
- Ergebnis: Issue #2223, PR #2224 (SHARD_COUNT 8 -> 24, der im Workflow selbst dokumentierte Stellhebel), gemergt 07:56 UTC. Verifikations-Dispatch: Lauf 30614546055 (auf #2223 protokolliert); der todgeweihte heutige 8er-Shard-Lauf 30609449268 wurde manuell abgebrochen.

## 5. Neues Rot durch den Sammellauf-Testlauf entdeckt: prosemirror-model doppelt (09:33)

- Befund: Der lokale RED-Beweis des neuen Rollup-Skripts zeigte ein DRITTES Rot: der develop-Push nach dem #2220-Merge scheiterte in der vollen Vitest-Suite (`RangeError: ... multiple versions of prosemirror-model were loaded`, EditorToolbar). Eingrenzung über die Frontend-Job-Ergebnisse der develop-Pushes: #2214 grün -> #2215 (frontend-minor-patch-Gruppe) rot. Der TipTap-3.29.1-Bump ließ sieben verschachtelte Lock-Auflösungen auf prosemirror-model 1.25.9 stehen, während @tiptap/pm ^1.25.11 verlangt - zwei geladene Kopien, inkompatible Schema-Instanzen.
- Warum der PR grün war: Selektives Vitest (#615) zieht bei einem Lockfile-only-Bump keinen Editor-Test - die #1661-Klasse "grüner PR -> roter Push", Dependency-Bump-Ausgabe.
- Verworfene Wege: `bun update` purgt die verschachtelten Einträge nicht; ein voller Familien-Re-Resolve zog nebenbei `@emnapi/core 2.0.0-alpha.3` (Alpha - verboten) plus 460 fremde Lock-Zeilen und wurde zurückgesetzt.
- Ergebnis: Issue #2227, PR #2229 - exakt 7 gelöschte Lock-Zeilen, `bun install` löst gegen das vorhandene 1.25.11 auf. Beweis: eine Version im Lock UND in node_modules, volle Suite 7993/7993 lokal grün. Gemergt 07:47 UTC; der develop-Push-CI-Lauf 30614042369 (volle Suite) bestätigte danach success - develop komplett grün.
- Commit: c7350fdf
- Werkzeug-Randnotiz: `gh pr update-branch` existiert in der installierten gh-Version nicht (Exit 1, "unknown command") - Branch-Updates liefen erst über `gh api -X PUT .../pulls/N/update-branch`. Passt zur bekannten gh-Silent-Fail-Klasse; Mutationen immer verifizieren.

## 6. Übrige Klassifikationen (09:40)

- Release - prepare (rot seit 24.07.): `make release-test` scheiterte im v2.6.1-Zyklus auf dem Release-Branch; v2.6.1 wurde am selben Tag fertiggestellt (release-finish 17:03 grün). Historisches Rot eines Dispatch-only-Workflows - kein Handlungsbedarf, bleibt als Audit-Spur stehen.
- File-size watcher (letzter Lauf 13.06.): Alt-Registrierung des PR-#370-Branches; die Datei existiert auf develop nicht, ihr Inhalt lebt als Ratchet in cohesion-check.yml (gates.yaml:80). Nicht rot, nur eine kosmetische Karteileiche in der Workflow-Liste.
- Visual baseline sync (5x skipped): konditionaler Housekeeping-Workflow (Label-getriggert), skipped ist der Normalzustand.
- Deploy Preview (1x cancelled in Historie): Concurrency-Supersede, kein Befund.

## 7. Teil 3: Sammellauf für rote Läufe außerhalb von PRs (09:45)

- Prüfung vor Bau: Benachrichtigungsempfänger geplanter Läufe ist der `triggering_actor` (verifiziert: astrapi69 auf 30609689365 und 30518119839) - der Kanal existiert. Empirisch blieben aber fünf mehrtägige Rot-Strähnen seit Juni unbehandelt, und `cancelled`-Abbrüche benachrichtigen nie. Kanal vorhanden, nachweislich unzureichend - der Sammellauf ist gerechtfertigt, GitHub-Bordmittel reichen nicht.
- Ergebnis: Issue #2225, PR #2232 (gemergt 07:59 UTC). `scripts/verify_workflow_health.py` + `.github/workflows/red-runs-rollup.yml` (täglich 09:17 UTC + Dispatch): je aktivem Workflow der letzte abgeschlossene schedule/push-Lauf im 10-Tage-Fenster; alles außer success/skipped/neutral ist rot (fail closed bei Unbekanntem). Dispatch-only-Workflows sind bewusst ausgenommen - ihr historisches Rot würde den Sammellauf dauerhaft rot machen, die Falle "dauerhaft rot = so unwirksam wie nie meldend".
- Ehrliche Einordnung im Workflow-Kopf: ersetzt das Durchsehen des Reiters durch EINE Stelle, ersetzt das Hinsehen nicht, ist kein Merge-Gate.
- Vertragspunkte (#2083): 8 Subprocess-Tests mit gh-Stub auf dem PATH (Rot-Erkennung, sauberer Durchlauf, cancelled-ist-rot, Fenster-Grenze, fail closed bei API-Fehler / null Workflows / null gezählten Läufen, Mengen-Ausweis). Live-RED-Beweis gegen das echte Repo vor dem Merge: Exit 1 mit exakt den 3 damals bekannten Roten aus 29 geprüften Workflows.
- Erstlauf nach Merge (wired != working): Lauf 30614700210, conclusion failure - KORREKT: exakt die zwei noch stehenden stale Nightly-Rots gemeldet (content-stats 30609689365, mutation 30609449268), 29 geprüft / 19 gezählt / 2 rot. Beide drehen mit der morgigen Nachtschicht; bleibt der Sammellauf am 01.08. rot, ist das ein echter Folgefall. Auf #2225 protokolliert.
- Klassifikation: gates.yaml `no_rule` + checks.yaml `red-runs-rollup` (active); verify-gate-rule-links 11/18 und verify-check-inventory 18/5 grün.

## Statistik

- Issues: #2219 (neu, geschlossen), #1531 (wiedereröffnet, geschlossen), #2223 (neu, geschlossen), #2227 (neu, geschlossen), #2225 (neu, geschlossen)
- PRs: #2220, #2221, #2224, #2229, #2232 - alle gemergt
- Klassifikationen: 3x echter Befund (Ratchet-Gewinn, README-Drift, prosemirror-Duplikat), 1x Werkzeugfehler (Mutation-Shard), 2x historisch/kein Handlungsbedarf (release-prepare, File-size watcher)
- Tests: +8 (test_verify_workflow_health.py), volle Vitest-Suite 7993/7993 nach Dedupe

## 8. Nachtrag: Mutation-Verifikation brauchte zwei Anläufe (12:00-14:00)

- Befund: Der erste Verifikationslauf (30614546055, SHARD_COUNT=24, headSha korrekt der Merge-Commit) starb ebenfalls exakt an der 120-Minuten-Grenze: der Tages-Shard hatte 1383 Mutanten (Verschränkung verteilt ungleich), nach 1h54m erst 1311 getestet. Die 45-70-Minuten-Schätzung beruhte auf der Anfangsrate (~22 Mutanten/min); nachhaltig sind es eher ~7-12/min, weil Timeout- und Survivor-Mutanten das Ende dominieren.
- Ergebnis: #2223 wiedereröffnet, PR #2246 (SHARD_COUNT 24 -> 48), gemergt 10:02 UTC. Zweiter Verifikationslauf 30622137904: SUCCESS nach 109m41s (Shard 20/48: 9 von 418 Dateien, 778 Mutanten, 214 survived, 4 timed out, Report-Artefakt 680 KB). Vorbehalt auf #2223 protokolliert: nur 10 Minuten Marge - ein dickerer Shard kann das Budget weiterhin sprengen.

## 9. Concurrency-Messung: 2 vs 4 auf identischem Scope (14:00)

- Frage des Maintainers: bringt Stryker-concurrency 4 (Runner hat 4 vCPU, Config nimmt 2) verifizierbaren Gewinn, ohne die Mutations-Urteile zu verfälschen?
- Aufbau: identischer Scope (src/api/**/*.ts, 806 Mutanten), zwei Dispatches gleicher Wandzeit - develop (c=2, Lauf 30628731057) gegen Messbranch (c=4, Lauf 30628732645, Ein-Zeilen-Diff). Beide liefen in die 120-Minuten-Grenze; der Vergleich beim Cutoff ~1h53m trägt trotzdem.
- Ergebnis: c=4 testete nur 4,5% mehr Mutanten (716 vs 685), erzeugte aber 64 Timeout-Urteile gegen NULL bei c=2 - Worker-Contention schiebt Grenzfall-Tests über timeoutMS, Survivors verschwinden fälschlich in "killed by timeout" (108 -> 85). Urteils-Drift bei null Nutzen: concurrency bleibt 2. Messbranch gelöscht, Ergebnis auf #2223. Ehrlicher Resthebel für die Wandzeit: Stryker --incremental (braucht Artefakt-Persistenz zwischen Nightlies), eigene Entscheidung.

## 10. README-Abzeichen: Mutation (Teil 1+2) und die übrigen (Teil 3) (13:00-14:00)

- CC-Prompt Mutationsabzeichen: Entscheidung KEIN Abzeichen - es existiert keine badge-fähige Einzelzahl (nur Frontend; je Nacht ein 1/48-Shard von etwa 2% des Scopes; Scores nachtweise nicht vergleichbar; Report = 14-Tage-Artefakt ohne Aggregation; bis heute hatte kein geplanter Lauf je abgeschlossen). Stattdessen klärender Satz unter ## Tests in beiden READMEs: das Tests-Abzeichen nennt eine Größe, keine Stärke. Issue #2257, PR #2258, gemergt 13:05 UTC.
- Teil 3 (übrige Abzeichen): drei selbstaktualisierende aufgenommen - CI (develop) als passiver Wächter (develop war diese Woche zweimal unbemerkt rot), Nachtschicht (red-runs-rollup-Badge, dieselbe Sorge für die schedule/push-Fläche) und Image (shields github-release mit Label image, verlinkt auf das GHCR-Paket; Release-Tag = Image-Tag durch die Publish-Kette). Abgelehnt mit Begründung: Coverage (schwächere Aussage als die Mutationsrate, lädt zum Schönrechnen ein), Stil/Werkzeug (sagen nichts), Downloads (keine Information), Barrierefreiheit (Prüfwerkzeug deckt einen Bruchteil der Regeln). Vertagt zur Maintainer-Entscheidung: Inhaltszahlen und Sprachenzahl (beide würden unverifizierte KI-Sprachsets mitbewerben). Issue #2259, PR #2260, gemergt 13:10 UTC.

## Statistik (Nachtrag)

- Weitere Issues: #2223 (wiedereröffnet + erneut geschlossen), #2257 (geschlossen), #2259 (geschlossen)
- Weitere PRs: #2240 (Journal), #2246, #2258, #2260 - alle gemergt
- Messläufe: 30614546055 (cancelled, widerlegte SHARD_COUNT=24), 30622137904 (success, 109m41s), 30628731057 + 30628732645 (Concurrency-Vergleich, beide Timeout, Auswertung über Cutoff-Vergleich)
