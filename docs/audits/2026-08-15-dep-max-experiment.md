# Dep-Max-Experiment: Was passiert, wenn alles aufs Maximum geht? (2026-08-15)

Probe-Branch `exp/dep-max-2026-08-15` (lokal, bewusst NICHT gemergt oder
gepusht): jede Abhängigkeit auf die neueste veröffentlichte Version
gehoben - inklusive Majors und Range-gedeckelter Pakete - und gemessen,
was bricht. Grundlage: `make release-outdated` vom selben Tag. Der
Routine-Anteil (in-range Patch/Minor) war zuvor separat gemergt (#2621);
dieses Experiment misst den Rest.

Messmethode je Front: installieren, dann `tsc --noEmit` + ESLint +
`vitest run` + `bun run build` (Frontend) bzw. `pytest` + `mypy` + `ruff`
je Suite (Backend/Plugins), plus gezielte Direktproben. Befunde sind
Momentaufnahmen des 2026-08-15 - Trigger-Bedingungen unten neu prüfen
statt Zahlen fortschreiben.

## Ergebnis in einer Zeile

Fast alles geht sofort oder mit kleinem, lokalisiertem Aufwand. Zwei
echte Migrationen (fastapi 0.141, @assistant-ui 0.15), ein unverändert
harter externer Blocker (TypeScript 7).

## Ergebnistabelle

| Paket | von -> nach | Ergebnis |
|---|---|---|
| @tiptap/* (24 Pakete, Lockstep) | 3.29.2 -> 3.30.1 | GRÜN: tsc + ESLint + Build + volle Vitest-Suite (8630) - sofort bumpbar |
| @assistant-ui/react | 0.14.29 -> 0.15.14 | BRICHT: 6 tsc-Fehler, eine Datei (`AssistantUiThread.tsx`) - `useComposerRuntime` / `useMessage` entfernt. Migration: #2624 |
| typescript | 6.0.3 -> 7.0.2 | BLOCKIERT (extern, unverändert #1507): typescript-eslint@8.67.0 peer-capped `>=4.8.4 <6.1.0`, kein v9-/next-Tag. Re-Check: `npm view typescript-eslint@latest peerDependencies` |
| @stryker-mutator/* | 9.6.1 -> 10.0.0 | GRÜN (Probe): Scoped-Run über `lesson-step-state.ts` läuft in 48 s durch, Report normal |
| highlight.js, sql.js, @xyflow, dexie, axe-core, user-event, visualizer, tree-kit | - | bereits via #2621 (in-range) bzw. hier mitgehoben, unauffällig |
| fastapi + starlette | 0.136.3/1.3.1 -> 0.141.1/1.6.0 | TEILS: Laufzeit intakt (alle Plugin-Router mounten, Direktprobe zeigt alle Pfade; mypy 93 Dateien + ruff clean; 14/14 Plugin-Suiten grün = 1123 Tests). ROT: exakt 17 Backend-Tests, alle EINE Klasse - OpenAPI-/Routen-Introspektion (Schema-Cache vs. dynamischer Plugin-Mount im Lifespan). Migration: #2625 |
| anthropic | 0.55.0 -> 0.122.0 | GRÜN mit Kaveat (unten): 35/35 Plugin-Tests |
| openai (ai-openai + ai-perplexity) | 2.38 -> 3.1.0 | GRÜN mit Kaveat: 32/32 + 18/18 |
| google-genai | 2.7 -> 2.18.1 | GRÜN mit Kaveat (in-range, ^2.0-Pin genügt): 34/34 |
| datamodel-code-generator | 0.72.3 -> 0.73.0 | GRÜN: `make sync-schema` regeneriert sauber (reine Regen-Diffs) - bestätigt die #2602-Kopplung: Bump und Regen gehören in EINEN Commit |
| websockets | 16 -> 17 | NICHT PRÜFBAR als Direkt-Bump: transitiv über `uvicorn[standard]` (Range `>=0.48,<0.53`); folgt dem uvicorn-Zug |
| setuptools (Launcher) | 82 -> 84 | UNGETESTET (Major, Build-Backend) - eigener kleiner Zug mit PyInstaller-Spec-Build als Beweis |
| pluginforge / learn-content-engine | 0.10.0 / 0.22.0 | beide AKTUELL, kein Drift |

## Der Provider-Kaveat (wichtigster Vorbehalt)

Die grünen Provider-Suiten beweisen Import- und Aufrufform-Kompatibilität
der neuen SDKs, NICHT funktionierende echte API-Aufrufe: 2 von 3
Testdateien des ai-anthropic-Plugins mocken das SDK (gleiches Muster bei
openai/gemini). Das ist die "test through the real interface"-Lektion -
vor einem echten Provider-Bump gehört EIN manueller Live-Call je Provider
in den PR-Beweis (Session starten, eine Antwort streamen). anthropic
0.55 -> 0.122 ist zudem ein 67-Minor-Sprung im 0.x - Changelog-Sichtung
Pflicht (Backlog DEP-ANTHROPIC-105-01).

## Der fastapi-Befund im Detail

Pin-Hebung erzwingt den Lockstep über backend + alle Plugin-pyprojects
(Resolver verweigert sonst exakt wie in der v0.30.0-Lektion; 10 der 14
Plugins tragen den fastapi-Pin). Danach: Suite-Läufe zeigen 17 rote
Backend-Tests, ausschließlich OpenAPI-/Routen-Introspektion; dieselben
Pfade sind per Direktprobe (frischer TestClient nach Lifespan) alle
vorhanden. Arbeitshypothese: FastAPI 0.141 friert das OpenAPI-Schema
relativ zum Lifespan-Plugin-Mount anders ein als 0.136 -
testreihenfolge-abhängig. Fixrichtung + Ein-Zug-Scope in #2625.

## Abgeleitete Reihenfolge

1. **TipTap 3.30.1 sofort** - eigener Lockstep-PR, Beweislage komplett.
2. **#2624 assistant-ui** - klein, eine Datei, plus manueller
   Session-Chat-Check.
3. **#2625 fastapi-Zug** - Pins (backend + Plugins) + `lock-all-plugins`
   + Schema-Cache-Fix + codegen 0.73 + `sync-schema` in einem PR.
4. **Provider-SDKs** - nach #2625, je Provider mit Live-Call-Beweis.
5. **setuptools 84 (Launcher)** - Gelegenheitszug mit Spec-Build-Beweis.
6. **TS7** - warten auf typescript-eslint mit `typescript >=7`-Peer
   (#1507-Trigger unverändert).

Nebenbefund Maschine, kein Repo-Thema: die Launcher-Poetry-Umgebung
meldet ein invalides System-Dist
(`/usr/lib/python3.14/dist-packages/tqdm-4.67.3.dist-info`) - bei
Gelegenheit manuell entfernen.
