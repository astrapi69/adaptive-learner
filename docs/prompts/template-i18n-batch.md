# Vorlage: Übersetzungs-Batch

Übersetze/ergänze: {Key-Bereich oder Feature, z. B. lesson.motivation.*}
über ALLE Kataloge unter `backend/config/i18n/` (Liste = Verzeichnis,
keine Zahl hartkodieren).

## Regeln (nicht streichen)

1. Issue zuerst; Changeset bleibt REIN i18n (Kataloge + generierte
   `frontend/src/data/i18n/*.json`) — eigener PR, nie mit Feature mischen;
   Übersetzungen landen VOR dem Feature-PR (pr-policy.md #2578).
2. Deutsch mit ECHTEN Umlauten (ä/ö/ü/ß); el/hi in echter Schrift, keine
   Transliteration — der `i18n-script-sanity`-Hook gated de/el/hi hart
   (lessons/docs-i18n.md).
3. Keine harten Zeitversprechen in User-Strings („bis zu einer Minute…“);
   skalierende Formulierung (lessons/docs-i18n.md).
4. Nach Katalog-Edit: `make sync-i18n` regeneriert die Frontend-JSONs —
   beide Hälften in den Commit.
5. E2E-Falle prüfen: `grep -rn "toContainText" e2e/ | grep -i "{alter
   englischer Wortlaut}"` — eine Assertion, die bisher nur den
   Fallback-Text traf, bricht durch die neue Übersetzung im Nightly
   (lessons/ci-gates.md); betroffene Specs im SELBEN PR locale-robust
   machen.
6. Gates: der PR läuft im reduzierten i18n_only-Pfad (Paritäts-Tests
   backend `test_i18n_parity.py` + frontend `i18n-sync.test.ts`) — beide
   lokal vorab grün.
7. Commit `i18n: ... (closes #NN)`; PR gegen develop.

## Platzhalter

- Quelle der Ausgangstexte: {en-Katalog / Feature-Spec / Issue}
- Placeholder-Inventar: {"{n}", "{name}" … müssen in jeder Sprache erhalten bleiben}
