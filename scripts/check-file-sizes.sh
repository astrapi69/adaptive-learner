#!/usr/bin/env bash
# check-file-sizes.sh - Kohäsions-Watcher für CI
#
# Drei Stufen:
#   WHITELIST (.filesize-whitelist)  - bewusst grosse, kohäsive Dateien; nie ein Fehler
#   BASELINE  (.filesize-baseline)   - Ratchet: bestehende God-Files, aktueller Stand
#                                       toleriert, darf aber NICHT wachsen (#372)
#   Schwellen:
#     WARN_THRESHOLD  (default 500)  - Warnung im PR, kein Fail
#     ERROR_THRESHOLD (default 1000) - blockiert den Merge (exit 1)
#
# Es werden nur versionierte Quellen geprüft (git ls-files). Generierte,
# gitignorierte Verzeichnisse (site/, frontend/dev-dist/, ...) entfallen damit
# automatisch; Test-/Spec-Dateien werden per Konvention ausgeschlossen.
#
# Exit-Codes:
#   0 = sauber, nur Warnungen, oder nur tolerierte Baseline-Dateien
#   1 = mindestens eine Datei über ERROR_THRESHOLD oder über ihrer Baseline

set -euo pipefail

WARN_THRESHOLD="${WARN_THRESHOLD:-500}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-1000}"
WHITELIST_FILE=".filesize-whitelist"
BASELINE_FILE=".filesize-baseline"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Whitelist laden (ein Pfad pro Zeile, # = Kommentar) ---
declare -A WHITELISTED
if [[ -f "$WHITELIST_FILE" ]]; then
    while IFS= read -r line; do
        line="${line%%#*}"        # Kommentare entfernen
        line="${line// /}"        # Whitespace trimmen
        [[ -z "$line" ]] && continue
        WHITELISTED["$line"]=1
    done < "$WHITELIST_FILE"
fi

# --- Baseline laden (Ratchet) ---
# Format pro Zeile: <relativer Pfad>  <max-Zeilen>   (# = Kommentar)
declare -A BASELINE
if [[ -f "$BASELINE_FILE" ]]; then
    while IFS= read -r line; do
        line="${line%%#*}"
        [[ -z "${line// /}" ]] && continue
        read -r bl_path bl_max _ <<< "$line"
        [[ -z "$bl_path" || -z "${bl_max:-}" ]] && continue
        [[ "$bl_max" =~ ^[0-9]+$ ]] || continue
        BASELINE["$bl_path"]="$bl_max"
    done < "$BASELINE_FILE"
fi

# --- Quelldateien auflisten ---
list_source_files() {
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        # Versioniert + neue, nicht-ignorierte Dateien; --exclude-standard
        # haelt gitignorierte Build-Artefakte (site/, dev-dist/, ...) draussen.
        git ls-files --cached --others --exclude-standard -- '*.py' '*.ts' '*.tsx' '*.js' '*.jsx'
    else
        find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
            ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/build/*" \
            ! -path "*/__pycache__/*" ! -path "*/migrations/*" ! -path "*/.venv/*" \
            ! -path "*/venv/*" ! -path "*/.git/*" ! -path "*/coverage/*" \
            ! -path "*/.next/*" ! -path "*/site/*" ! -path "*/dev-dist/*" \
            | sed 's|^\./||'
    fi
}

FILES=$(list_source_files \
    | grep -vE '(^|/)(tests?|e2e)/' \
    | grep -vE '\.(test|spec)\.(ts|tsx|js|jsx)$' \
    | grep -vE '(^|/)test_[^/]*\.py$' \
    | grep -vE '(^|/)conftest\.py$' \
    | sort)

# --- Zählen und bewerten ---
warnings=0
errors=0
baselined=0
total_checked=0

# ``${#ARR[@]}`` on an EMPTY associative array errors under ``set -u`` (even on
# bash 5), so count via the ``-v`` guard. An empty baseline is the success state
# of the ratchet: every god-file has been split (#411 emptied the backend side).
whitelist_count=0
[[ -v WHITELISTED[@] ]] && whitelist_count=${#WHITELISTED[@]}
baseline_count=0
[[ -v BASELINE[@] ]] && baseline_count=${#BASELINE[@]}

printf "\n=== Kohäsions-Check: Dateigrößen ===\n"
printf "Warn-Schwelle: %d Zeilen | Error-Schwelle: %d Zeilen\n" "$WARN_THRESHOLD" "$ERROR_THRESHOLD"
printf "Whitelist: %d Eintraege | Baseline: %d Eintraege\n\n" "$whitelist_count" "$baseline_count"

for relpath in $FILES; do
    [[ -f "$relpath" ]] || continue
    lines=$(wc -l < "$relpath")
    total_checked=$((total_checked + 1))

    # 1) Whitelist: bewusst gross + kohäsiv -> nie ein Fehler
    if [[ -n "${WHITELISTED[$relpath]:-}" ]]; then
        [[ "$lines" -gt "$WARN_THRESHOLD" ]] \
            && printf "  SKIP  %6d  %s  (whitelisted)\n" "$lines" "$relpath"
        continue
    fi

    # 2) Baseline (Ratchet): aktueller Stand toleriert, darf aber nicht wachsen
    if [[ -n "${BASELINE[$relpath]:-}" ]]; then
        bl="${BASELINE[$relpath]}"
        if [[ "$lines" -gt "$bl" ]]; then
            printf "  ERROR %6d  %s  (Baseline %d überschritten - aufsplitten)\n" "$lines" "$relpath" "$bl"
            errors=$((errors + 1))
        else
            printf "  BASE  %6d  %s  (eingefroren bei <=%d; siehe #372)\n" "$lines" "$relpath" "$bl"
            baselined=$((baselined + 1))
        fi
        continue
    fi

    # 3) Normale Schwellen
    if [[ "$lines" -gt "$ERROR_THRESHOLD" ]]; then
        printf "  ERROR %6d  %s  (neues God-File > %d)\n" "$lines" "$relpath" "$ERROR_THRESHOLD"
        errors=$((errors + 1))
    elif [[ "$lines" -gt "$WARN_THRESHOLD" ]]; then
        printf "  WARN  %6d  %s\n" "$lines" "$relpath"
        warnings=$((warnings + 1))
    fi
done

printf "\n--- Ergebnis ---\n"
printf "Geprüft:   %d Dateien\n" "$total_checked"
printf "Baseline:  %d Datei(en) eingefroren (toleriert, siehe #372)\n" "$baselined"
printf "Warnungen: %d (> %d Zeilen)\n" "$warnings" "$WARN_THRESHOLD"
printf "Fehler:    %d (> %d Zeilen bzw. Baseline überschritten)\n" "$errors" "$ERROR_THRESHOLD"

if [[ "$errors" -gt 0 ]]; then
    printf "\nKohäsions-Richtlinie verletzt. %d Datei(en) zu gross.\n" "$errors"
    printf "Optionen: aufsplitten, oder mit Begründung eintragen in\n"
    printf "  .filesize-whitelist (bewusst gross + kohäsiv) bzw.\n"
    printf "  .filesize-baseline (befristete Altlast, darf nicht wachsen).\n"
    exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
    printf "\n%d Datei(en) über %d Zeilen. Kein Blocker, aber Refactoring empfohlen.\n" \
        "$warnings" "$WARN_THRESHOLD"
fi

printf "\nKohäsions-Check bestanden.\n"
exit 0
