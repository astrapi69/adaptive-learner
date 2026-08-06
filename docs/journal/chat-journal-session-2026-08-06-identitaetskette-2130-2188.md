# Chat-Journal 2026-08-06 - Identitätskette: #2130 Schlüsselwechsel + #2188 retired_ids-Archivierung

## 1. Statusbericht + lce-Korrelation (#2130) (12:15)

- Original prompt: "Statusbericht von den gh-issues", dann "check mal #2130 in wie fern das mit lce korreliert"
- Optimized prompt: "Erstelle den Issue-Statusbericht und prüfe für #2130, welche Engine-Lieferungen (learn-content-engine) es noch blockieren und welche Kopplungen offen sind."
- Ziel: Klarheit, ob #2130 noch upstream-blockiert ist.
- Ergebnis: Nicht mehr blockiert. Engine hat alles geliefert (engine#90 CLOSED, Schema 1.9, stable_id in 47/47 Sets, Pin 0.20.0 seit PR #2446). Einziger Blocker war die eigene Release-Kopplung (Schlüsselwechsel + Abgleich im selben Release). Zwei Rest-Kopplungen: engine#91 (Element-Ebene, Monitoring, Ordinal-Option dort als verworfen dokumentiert) und #2188 (umgekehrte Richtung: Engine wartet auf App). Statusbericht-Korrektur gegenüber Vormittag: "stable_id noch nicht in Produktions-Schema" war veraltet.

## 2. #2130: Schlüsselwechsel auf stable_id + lokaler Remap (PR #2455) (13:15)

- Original prompt: "dann machen wir das was wir machen sollen: #2188 ... #2130 ..."
- Optimized prompt: "Setze das Paket #2130+#2188 um: erst den Schlüsselwechsel mit Remap (Kopplungsbedingung: beides im selben Release), dann darauf die retired_ids-Archivierung."
- Ziel: Fortschritts-/SRS-Schlüssel versionsstabil machen, ohne Bestandsdaten zu verwaisen.
- Ergebnis: PR #2455 (Squash 5f5269fd), Issue #2130 geschlossen.
  - Neues Remap-Primitiv exercise_id alt->neu in BEIDEN Modi (Backend `POST /element-errors/remap-exercise-ids`, Dexie delete+put unter neuem Composite-Key); idempotent, kein Double-Map, (set, lesson)-scoped.
  - Schreibpfad stempelt `stable_id ?? id`; Richtungs-Seed bleibt bewusst auf der Autoren-Id (sonst kippt jede "random"-Übung die Richtung und strandet ihre Zeilen).
  - Neues Modul `lib/srs/exercise-identity.ts` (`exerciseIdentityOf` / `matchesExerciseIdentity`); alle sieben Auflöse-Stellen (review-lesson, exercise-pool, error-classifier x2, lesson-generator x2, error-replay) plus Hint-Tracking tolerant für Alt- UND Neu-Schlüssel.
  - Guard-Kette: update-impact indexiert eingehende Übungen unter BEIDEN Ids, remap-plan findet über beide.
  - Migration `stable-id-migration.ts`: Zuordnung lokal aus den Lektionsdateien (add-only: beide Ids in derselben Datei), per-Set-Feature-Detection, idempotent, KEIN Marker-Store. Seams: syncUserRepo VOR dem Assess + applyDownload nach Download - damit sind alle Update-Pfade abgedeckt und die Kopplungsbedingung strukturell erfüllt.
  - Kein `.alb`-Bump nötig (Schlüssel sind opake Strings, Migration wiederholbar) - Prämissenkorrektur gegenüber dem Issue-Text, im PR deklariert.
- Commit: 2f683a7b (Branch), Squash 5f5269fd auf develop.

## 3. #2188: retired_ids-Konsum + Archivierung (PR #2458) (14:20)

- Ziel: Architekten-Entscheid vom 31.07. umsetzen (archivieren, nicht löschen, nicht verwaisen; Nutzer erfährt es einmal, mit Zahl).
- Ergebnis: PR #2458 (Squash 4d003604), Issues #2188 + #2456 geschlossen.
  - Backend: `ElementError.retired_at` (Migration 0035), `archive-retired`-Endpoint (idempotent, set-scoped), `include_retired`-Filter (Default false: archivierte Zeilen verlassen jede Default-Lesung inkl. Review-Queue).
  - Nebenbefund als eigenes Issue #2456 dokumentiert und im selben Zug behoben: die Sync-Spaltenliste von element_errors ließ FÜNF Modell-Spalten aus (hint_used, hint_used_count, last_attempt_exam, attempt_count, attempt_history - seit Migrationen 0030/0031/0034). Hint-Ökonomie, Exam-Boost und Attempt-Historie fuhren weder in Sync noch ins .alb-Backup. Klasse: zweite Schreibstelle neben dem Modell; Paritäts-Pin als Kandidat im Issue notiert.
  - Dexie gespiegelt (#2053): `retired_at` inline (kein Schema-Bump), `archiveRetiredDexie`, Filter in List + Review-Queue.
  - Flow: `peekSetUpdate` liest `metadata.retired_ids` im selben Fetch-Pass wie die Lektionen; `computeUpdateImpact` klassifiziert deklarierte Ausmusterungen als `retiredCards` (nie brechend - ein Nur-Ausmusterungs-Update läuft durch statt den #2128-Hold auszulösen); Apply-Seams archivieren nach dem Download (Migration #2130 läuft davor); einmaliger Zähl-Toast auf jedem Pfad, i18n in allen 11 Katalogen, Paritäts-Gate um den neuen Schlüssel erweitert.
  - Testplan DE + EN: neue Sektion "Ausmusterung: archivierter Fortschritt bei retired_ids (#2188)" (TESTPLAN-PFLICHT).
- Engine-Spur angestoßen: learn-content-engine#131 - `E-RETIRED-IDS-LOCKED` kann fallen, beide Vorbedingungen (entschieden + umgesetzt) erfüllt.

## 4. Prozess-Stolpersteine der Session

- Worktree-Venv unvollständig: erster `make test`-Lauf rot (`No module named 'sqlalchemy'`) UND der Fehlschlag maskiert, weil `| tail` den Exit-Code schluckte. Fix: `poetry install --sync` + RC explizit in Datei schreiben (`echo "MAKE_TEST_RC=$?"`). Deckt sich mit Memory "Worktree-Env-Installs".
- visual-baseline-gate: getriggert durch die zwei Lesson-Komponenten (reine Identitäts-Logik, kein Pixel). Escape-Label `visual-baselines-unaffected` gesetzt - aber der RERUN des alten Runs las die ALTE Event-Payload (ohne Label) und blieb rot, während der labeled-getriggerte Run längst grün war. Lösung: Label toggeln (unlabel + relabel) erzeugt einen frischen Run mit frischer Payload. Rerun eines pull_request-Runs re-evaluiert Labels NICHT.
- `gh pr checks | awk '$2=...'`: Checknamen enthalten Leerzeichen - ohne `-F'\t'` prüft awk das falsche Feld; ein Warte-Loop "settlte" dadurch zu früh. Tab-Separator setzen.
- Umlaut-Ratchet (docs-hygiene) fing +11 ASCII-Substitute in der neuen DE-Testplan-Sektion - Commit abgelehnt, mit echten Umlauten neu geschrieben. Der Hook greift; die eigene Erst-Autorenschaft war der Drift-Vektor (Memory "German prose: real umlauts from first draft" bestätigt).
- strict:true auf develop: PR #2455 war nach dem Vormittags-Merge BEHIND; `gh api update-branch` + CI-Neulauf nötig, erst dann Merge.

## Statistik

- 2 Feature-PRs gemergt: #2455 (31 Dateien, +1077/-74), #2458 (54 Dateien, +838/-39)
- 4 Issues geschlossen: #2130, #2188, #2456 (neu angelegt + behoben), plus engine-seitig #131 neu angelegt (Auftrag an Engine-Spur)
- Tests: make test 2x voll grün (804->805 Vitest-Dateien, 8366->8373 Tests), RED-first durchgängig (8 Backend- + 8 Dexie-Tests neu, gespiegelt), OpenAPI-Snapshot 2x regeneriert (128->129 Pfade)
- Offene Folgearbeit: engine#91 bleibt Monitoring; step_id-Namensraum (step_results) nicht Teil von #2130; BACKUP-AKZEPTANZTEST-Rundlauf beim nächsten backup-berührenden Release fällig (Sync-Spalten additiv erweitert)
