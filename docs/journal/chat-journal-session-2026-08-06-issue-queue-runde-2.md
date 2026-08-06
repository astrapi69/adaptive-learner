# Chat-Journal 2026-08-06: Issue-Queue Runde 2

- Original prompt: "Alles gemerged. Nochmal alle gh-issues checken und schritt für schritt abarbeiten"
- Goal: Frische Triage der 16 verbliebenen offenen Issues, alles Aktionierbare liefern - mit Prämissen-Verifikation vor jedem Schritt (Lehre aus Runde 1: fünf Buchführungsfehler an einem Tag).

## 1. #2306: App-Scheiben des search-index-Formats (10:05)
- Result: Punkt 2 - buildSearchIndexJson validiert jetzt gegen einen Byte-Spiegel des offiziellen search-index.schema.json (Ajv 2020-12, zwei Negativkontrollen, Kohärenz-Pin Index-Fixture gegen Schema-Fixture). Punkt 4 - readIndexMeta liest über den kanonischen Loader (parseSearchIndex + neues indexSchemaVersion); dessen Test-Fixture trug die tolerante Handparse-Form (nacktes Sprachpaar ohne id), auf schema-valide Form gehoben. Prämissen-Korrektur: Punkt 1 (Schema-Spiegel in die Content-Repos) war upstream LÄNGST umgesetzt (content#175, alle 10 Schreib-Repos) - keine neue Bedarfsanmeldung nötig; Punkt 3 durch die gemeinsame Schema-Validierung entschärft.
- Commit: 1a90835a (PR #2440, gemergt; Issue zu)

## 2. #2182: Pre-flight Check 1 abgeschlossen (10:20)
- Result: Der seit #2203 offene Leser-Schritt - Live-Read der Branch-Protection - war für frühere Sessions nicht möglich, für diese schon: enforce_admins=false, strict=true, 7 Pflicht-Kontexte. complexity-gate (der Hauptverdächtige) ist NICHT pflichtig; alle 7 Kontexte laufen pfadfilterfrei auf jedem PR. Check 1 damit GEKLÄRT, der enforce_admins-Schalter nachweislich sicher. Vorbehalt zur Check-2-Empfehlung auto-delete dokumentiert (Sync-PR-Falle). Einzig verbleibende Handlung: Asters Toggle.
- Kein Commit (Analyse-Kommentar auf dem Issue)

## 3. #2311: Statusvermerk nach #2438 (10:25)
- Result: Gegen den Code verifiziert (nicht aus den älteren Kommentaren): alle 5 Bedingungen des Issues sind auf develop erfüllt (Pin 0.11.0, Version+Umfang in der Ausgabe, kein auto-lower, rationale, Journal-Ausschluss; Grundlinie 980/532). Offen ist allein der ausdrücklich freigabepflichtige Fixer-Lauf mit den drei Ausnahmen. Vorschlag an RM: schließen und Lauf als eigenen Vorgang führen, oder offen halten bis zum Lauf.
- Kein Commit (Statusvermerk)

## 4. #2273: Reviewed-Content-Badge (10:30)
- Result: Entblockt - engine#94 zu, alle 10 Content-Repos stempeln review_status. Sibling-Checkout war 28 Commits alt, vor der Messung ff-gepullt; das Feld sitzt am ROOT-Manifest-Eintrag UND genestet im Set-Manifest (erste Implementierung las die falsche Ebene - vom Test gefangen, Lesepfad: Root primär, genestet als Fallback). validate_bundled_content.py: Badge zählt NUR bewerbbares (review_status != "generated") - real 25 Sets / 12 Sprachpaare, 3 generierte (ja/ko/zh) ausgeschlossen mit Namensnennung in Review-Spalte + Ausschlussnotiz; alles im Marker-Block, --check-readme gated Drift. 4 neue Subprocess-Tests (RED zuerst), 8/8 grün.
- Commit: 9e52c746 (PR #2441, gemergt; Issue zu)

## 5. #2335: Anmeldung war behauptet, jetzt real (10:40)
- Result: Das Issue führte den Schema-Bedarf als "angemeldet", die Engine trug KEIN Issue dazu (einziges offenes: engine#91) - dieselbe Prämissen-Klasse. Der im Issue vorbereitete Ready-to-file-Text ist wortgleich als learn-content-engine#127 eingereicht und rückverlinkt; Entblock-Kriterium (engine#127 zu + sync-schema-Re-Pin im selben PR) am Issue notiert.
- Kein Commit (Upstream-Issue + Kommentar)

## Rest-Queue nach Runde 2 (12 offen)
- Upstream: #2335 (engine#127), #2130/#2128/#2188 (engine#91-Familie + Wegewahl aus #2301), #2125, #2301 (Entscheidungsvorlage liegt vor).
- RM-Entscheidung: #2182 (nur noch der Toggle), #2187, #2189, #2311 (Fixer-Freigabe).
- Gerät/Mensch/Großvorhaben: #1569 (vvdiag wartet auf iPhone), #1728, #1087, #1485.

## Statistik Runde 2
- 2 PRs gemergt (#2440, #2441), 2 Issues geschlossen (#2306, #2273), 1 Upstream-Issue eingereicht (engine#127), 2 Analyse-/Statuskommentare (#2182, #2311).
- Prämissen-Korrekturen: 3 (content#175 schon umgesetzt; review_status-Ebene; engine-Anmeldung fehlte).
