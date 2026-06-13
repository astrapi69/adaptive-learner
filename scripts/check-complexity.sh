#!/usr/bin/env bash
#
# Complexity watcher (warn-only, Phase 1) - #400.
#
# Python: radon cyclomatic complexity (average + rank B-and-worse), with
# functions ranked E or F surfaced as warnings. TypeScript: eslint's
# ``complexity`` rule at threshold 20. Defense-in-depth like the cohesion
# (#371) and security-scan watchers: visibility first, hard gate later.
#
# Never exits non-zero in Phase 1 - a complex function is reported but
# never blocks a commit or a merge. If a tool is unavailable (e.g. no
# python3-venv locally) that section is skipped, not failed.
#
# radon is run from an isolated venv (``.radon-venv``, auto-created on
# first run) so it never pollutes the system or backend Poetry env. Set
# RADON_VENV to override the location.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS=(backend/app plugins)

# --- Python: radon -------------------------------------------------------
RADON_VENV="${RADON_VENV:-$ROOT/.radon-venv}"
RADON_OK=0
if command -v radon >/dev/null 2>&1; then
    RADON=(radon)
    RADON_PY=(python3)
    RADON_OK=1
elif [ -x "$RADON_VENV/bin/radon" ]; then
    RADON=("$RADON_VENV/bin/radon")
    RADON_PY=("$RADON_VENV/bin/python")
    RADON_OK=1
else
    echo "Bootstrapping radon into $RADON_VENV ..."
    if python3 -m venv "$RADON_VENV" 2>/dev/null \
        && "$RADON_VENV/bin/pip" install --quiet --upgrade pip radon 2>/dev/null; then
        RADON=("$RADON_VENV/bin/radon")
        RADON_PY=("$RADON_VENV/bin/python")
        RADON_OK=1
    else
        echo "Could not bootstrap radon (python venv unavailable)."
        echo "Install 'python3-venv' or 'pipx install radon' to enable the Python check."
    fi
fi

if [ "$RADON_OK" -eq 1 ]; then
    echo "== Radon: average + cyclomatic complexity (rank B and worse) =="
    "${RADON[@]}" cc "${TARGETS[@]}" -a -nb || true

    echo
    echo "== Radon: functions ranked E or F (warn-only) =="
    "${RADON[@]}" cc "${TARGETS[@]}" --min E -j 2>/dev/null \
        | "${RADON_PY[@]}" "$ROOT/scripts/radon_warn.py"
fi

# --- TypeScript: eslint complexity --------------------------------------
echo
echo "== ESLint: frontend complexity (threshold 20, warn-only) =="
if [ -d frontend/node_modules ]; then
    (
        cd frontend
        npx --no-install eslint src --rule 'complexity: ["warn", 20]'
    ) || true
else
    echo "frontend/node_modules missing - run 'npm ci' in frontend/ to include the TS check."
fi

exit 0
