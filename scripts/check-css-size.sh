#!/usr/bin/env bash
# check-css-size.sh - Zufluss-Stopp fuer global.css (#1467)
#
# CSS ist der blinde Fleck der Groessen-Gates: check-file-sizes.sh /
# check-complexity.sh / check-directory-size.sh globben nur
# *.py *.ts *.tsx *.js *.jsx. Deshalb konnte global.css unbemerkt auf
# ueber 7500 Zeilen wachsen, obwohl die TAILWIND-ONLY-Regel gilt.
#
# Dieser Guard friert global.css bei seinem aktuellen Stand ein
# (.css-size-baseline) und laesst die Datei nur SCHRUMPFEN. Waechst sie
# ueber die Baseline, blockiert der Check (exit 1) - dasselbe Ratchet-
# Prinzip wie .filesize-baseline (#372).
#
# Seit dem Concern-Split (#1655) zaehlt der Guard die SUMME aus
# global.css + frontend/src/styles/legacy/*.css: der Split verschiebt
# Zeilen in Concern-Dateien, und die Baseline darf durch das Verschieben
# nicht umgehbar sein - die Gesamtmenge Legacy-CSS bleibt geratchet.
#
# Nach einer Reduktions-Tranche (siehe
# docs/audits/global-css-analysis-2026-07-08.md) die Baseline-Zahl
# nach unten setzen. Eine legitime Token-/Fundament-Erweiterung darf die
# Baseline mit begruendetem Kommentar minimal anheben (Escape-Hatch wie
# bei .filesize-baseline).
#
# Exit-Codes:
#   0 = global.css <= Baseline (sauber)
#   1 = global.css > Baseline (Zufluss gestoppt), oder Datei/Baseline fehlt

set -euo pipefail

BASELINE_FILE=".css-size-baseline"
TARGET="frontend/src/styles/global.css"
AUDIT="docs/audits/global-css-analysis-2026-07-08.md"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f "$TARGET" ]]; then
    printf "FEHLER: %s nicht gefunden.\n" "$TARGET"
    exit 1
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
    printf "FEHLER: %s fehlt (die eingefrorene Zeilen-Obergrenze).\n" "$BASELINE_FILE"
    exit 1
fi

# Baseline lesen: erste nicht-leere, nicht-Kommentar-Zeile = die Zahl.
baseline=""
while IFS= read -r line; do
    line="${line%%#*}"
    line="${line// /}"
    [[ -z "$line" ]] && continue
    baseline="$line"
    break
done < "$BASELINE_FILE"

if ! [[ "$baseline" =~ ^[0-9]+$ ]]; then
    printf "FEHLER: keine gueltige Baseline-Zahl in %s.\n" "$BASELINE_FILE"
    exit 1
fi

LEGACY_DIR="frontend/src/styles/legacy"
lines=$(wc -l < "$TARGET")
legacy_lines=0
if [[ -d "$LEGACY_DIR" ]]; then
    legacy_lines=$(find "$LEGACY_DIR" -name '*.css' -exec cat {} + 2>/dev/null | wc -l)
    lines=$((lines + legacy_lines))
fi

printf "\n=== CSS-Zufluss-Stopp: %s ===\n" "$TARGET"
printf "Baseline (eingefroren): %d Zeilen | aktuell: %d Zeilen (global.css + %d aus styles/legacy)\n\n" "$baseline" "$lines" "$legacy_lines"

if [[ "$lines" -gt "$baseline" ]]; then
    grew=$((lines - baseline))
    printf "  ERROR  %s ist um %d Zeile(n) ueber die Baseline gewachsen.\n\n" "$TARGET" "$grew"
    printf "global.css darf nicht wachsen (#1467). Neue Styles gehoeren\n"
    printf "als Tailwind-Utilities an die Komponente, neue Farben als Token\n"
    printf "nach styles/themes/theme-*.css bzw. global.css :root.\n"
    printf "Hintergrund + Abbauplan: %s\n" "$AUDIT"
    printf "\nAusnahme (legitime Token/Fundament-Erweiterung): Baseline in\n"
    printf "%s mit begruendetem Kommentar anheben.\n" "$BASELINE_FILE"
    exit 1
fi

if [[ "$lines" -lt "$baseline" ]]; then
    shrank=$((baseline - lines))
    printf "  OK     %s ist um %d Zeile(n) geschrumpft.\n" "$TARGET" "$shrank"
    printf "         Baseline in %s auf %d senken (Ratchet).\n\n" "$BASELINE_FILE" "$lines"
    exit 0
fi

printf "  OK     %s liegt exakt auf der Baseline.\n\n" "$TARGET"
exit 0
