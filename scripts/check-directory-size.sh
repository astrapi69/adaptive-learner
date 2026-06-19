#!/usr/bin/env bash
# check-directory-size.sh - God-Folder-Watcher für CI (#809).
#
# Zählt die FLACH (maxdepth 1) in einem Verzeichnis liegenden Quell-Dateien
# (*.ts / *.tsx, inkl. Tests) und warnt, wenn ein Verzeichnis zu viele
# enthält. Analog zum Filesize-Watcher (God-Files) verhindert dieser Check,
# dass God-Folders zurückkehren, nachdem sie nach Concern gruppiert wurden.
#
# Zwei Stufen:
#   WARN_THRESHOLD  (default 15) - Warnung, kein Fail (Standard-Lauf).
#   --gate          - exit 1, wenn ein NICHT in .dirsize-baseline gelistetes
#                     Verzeichnis über WARN_THRESHOLD liegt (Ratchet:
#                     bestehende, noch nicht migrierte God-Folders werden
#                     toleriert, dürfen aber nicht NEU entstehen).
#
# Nur versionierte Quellen unter frontend/src (git ls-files). Generierte /
# gitignorierte Bäume entfallen damit automatisch.
#
# Exit-Codes:
#   0 = sauber, oder nur Warnungen, oder nur tolerierte Baseline-Verzeichnisse
#   1 = (nur mit --gate) ein neues Verzeichnis über dem Schwellwert

set -euo pipefail

WARN_THRESHOLD="${WARN_THRESHOLD:-15}"
ROOT_DIR="${ROOT_DIR:-frontend/src}"
BASELINE_FILE=".dirsize-baseline"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

GATE=0
[[ "${1:-}" == "--gate" ]] && GATE=1

# Tolerated (not-yet-migrated) directories, one path per line, '#' comments ok.
declare -A BASELINE=()
if [[ -f "$BASELINE_FILE" ]]; then
    while IFS= read -r line; do
        line="${line%%#*}"; line="$(echo -n "$line" | xargs || true)"
        [[ -n "$line" ]] && BASELINE["$line"]=1
    done < "$BASELINE_FILE"
fi

# Count flat (maxdepth 1) tracked *.ts/*.tsx per directory. Co-located test
# files (*.test.ts/x) are excluded: the guard is about grouping SOURCE files
# by concern, and tests live next to their subject by convention.
declare -A COUNT=()
while IFS= read -r f; do
    [[ "$f" == */* ]] || continue
    case "$f" in *.test.ts|*.test.tsx) continue;; esac
    dir="${f%/*}"
    COUNT["$dir"]=$(( ${COUNT["$dir"]:-0} + 1 ))
done < <(git ls-files "$ROOT_DIR" | grep -E '\.tsx?$' || true)

status=0
warned=0
for dir in $(printf '%s\n' "${!COUNT[@]}" | sort); do
    n="${COUNT[$dir]}"
    (( n > WARN_THRESHOLD )) || continue
    if [[ -n "${BASELINE[$dir]:-}" ]]; then
        echo "BASELINE (tolerated): $dir has $n files (max $WARN_THRESHOLD)"
        continue
    fi
    echo "WARNING: $dir has $n files (max $WARN_THRESHOLD) — group by concern"
    warned=1
    (( GATE == 1 )) && status=1
done

if (( warned == 0 )); then
    echo "check-directory-size: OK — no un-baselined directory over $WARN_THRESHOLD flat files."
fi
exit $status
