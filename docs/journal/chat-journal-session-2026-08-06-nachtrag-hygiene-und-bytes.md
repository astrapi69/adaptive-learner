# Chat-Journal 2026-08-06 - Nachtrag: Regel-Konvergenz, Umlaut-Anwendungslauf, Kontrollbytes, jkz-Rettung

Fortsetzung der Identitätsketten-Session (siehe `chat-journal-session-2026-08-06-identitaetskette-2130-2188.md`). Vier Stränge, alle gemergt.

## 1. Worktree-Regel + Regel-Log-Konvergenz (PRs #2462, #2463) (14:45)

- Original prompt: Vorschlag aus der Engine-Spur, die Umgebungsfalle als Satz in die Einrichtungsbeschreibung zu heben statt ein Gate zu bauen.
- Ergebnis: implementation-workflow.md § Session start trägt jetzt die Frisch-Worktree-Vorbedingung (env-Pin VOR dem Install, keine Exit-Code-Maskierung per `| tail`, HEAD nach jedem Commit prüfen). Korpus-Ceiling +640 bewusst gehoben, RULE-CHANGE DECLARED. Beim Konvergenz-Check fiel auf: `make rule-change-log-check` läuft mit Default-Range `origin/develop..HEAD` und beißt auf gemergtem Stand nie - 7 Deklarationen (31.07.-05.08.) fehlten im Log. Maschinell nachgezogen (#2463); die Range-Schwäche ist im PR-Text benannt, nicht behoben.

## 2. #2311 Anwendungslauf des Umlaut-Fixers (PR #2466, Issue geschlossen) (15:30)

- Freigabe durch den RM in-session ("fang mit #2311 an"); der Gate-Tausch war bereits gelandet, offen war nur der freigabepflichtige Lauf.
- Die drei Blocker-Ausnahmen RED-first eingebaut: `docs/review/**` als Zitat-Zeugen (Fixer UND Detektor), generierte Artefakte per Kopfzeilen-Marker (Fix gehört in den Generator, #2465 angelegt), Versalien-Grep-Schlüssel (Private-Use-Maskierung um den Umschreiber, keine blockierenden Reste).
- Fixpunkt erreicht: A=0, B=0, 1177 Ersetzungen über 915 Zeilen in 518 von 600 Dateien. Grundlinie im SELBEN Commit gebankt: 980 auf 20 (19 Versalien + 1 Generator-String), rationale benennt beide Rest-Klassen.

## 3. #2464 Rohe Kontrollbytes (PR #2468, Issue geschlossen) (16:30)

- Zensus aus der Engine-Spur (learn-content-engine#135-Klasse): 13 rohe Bytes in 5 Frontend-Dateien machten sie für grep unsichtbar (fail-open für jede such-basierte Inventur). Per Byte-Scan gegengeprüft (2117 Dateien, exakt 13/5, Backend sauber), Bytes als Escapes neu geschrieben (laufzeit-identisch), zwei Purity-Gates RED-first (Vitest + pytest; der RED-Lauf listete exakt die 5 Dateien).
- Die Falle reproduzierte sich am eigenen Autor: beim Schreiben des Gate-Docstrings materialisierten 5 rohe Bytes in der neuen Testdatei; der Zensus-Re-Run fing sie vor dem Commit.

## 4. #2467 jkz-Rettung nach dem Schlüsselwechsel (PR #2469, Issue geschlossen) (17:15)

- Ertrag der im Issue geforderten Lese-Gegenprobe: jkz-Recovery matcht Lernerzeilen gegen die EINGEFRORENE Vorfallstabelle mit Autoren-exercise_ids; nach der #2130-Migration (Zeilen auf stable_id) fände die Erkennung 0 und die Rettungs-Notice erschiene nie. Das #2130-Konsumenten-Audit KONNTE das nicht sehen - genau diese Dateien waren grep-dunkel.
- Fix: Alias-Index Autoren-Id auf stable_id aus derselben Lektionsdatei, Dual-Key-Lookup (Muster aus update-impact), Index VOR der Detection, billiger Set-Guard davor. Remaps tragen weiter die exercise_id der ZEILE. RED-first, 17 Recovery-Tests grün.

## Lehren des Nachtrags

- Eine stumme Suche ist kein leerer Befund: dieselbe Byte-Klasse hat erst das Engine-Inventar, dann das App-Audit, dann den eigenen Gate-Autor erwischt. Lese-Gegenproben gehören in den PR-Text, wenn die Suchgrundlage kompromittiert war.
- Check-Default-Ranges auf gemergtem Stand sind eine Fail-open-Variante: `origin/develop..HEAD` ist leer, wenn HEAD develop IST.
- Serielle Selbst-Merges unter strict:true erzeugen eine BEHIND-Kette; `gh api update-branch` + Warten ist der Preis der Reihenfolge, kein Fehler.

## Statistik (Nachtrag)

- 5 PRs gemergt: #2462 (Regel), #2463 (Log), #2466 (#2311-Lauf), #2468 (#2464), #2469 (#2467)
- 4 Issues geschlossen (#2311, #2464, #2467 sowie #2456 vormittags), 2 neu angelegt und offen dokumentiert (#2465 Generator-String; engine-seitig alles zu)
- Umlaut-Ratchet 980 auf 20; Kontrollbytes 13 auf 0 mit zwei neuen Gates; 7 neue RED-first-Tests im Nachtrag
