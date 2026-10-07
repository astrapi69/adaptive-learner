#!/usr/bin/env bash
#
# Complexity watcher - #400 (Phase 1 warn-only) + #407 (Phase 2 ratchet gate).
#
#   (default)           warn-only: radon average + E/F + eslint complexity, the
#                       visibility view; never exits non-zero.
#   --gate              hard ratchet gate: compares the current offenders to
#                       .complexity-baseline and exits non-zero on a NEW
#                       over-threshold function or a regression above its frozen
#                       complexity (mirrors the .filesize-baseline ratchet #372).
#   --update-baseline   regenerate .complexity-baseline from the current
#                       offenders (the file may only shrink).
#
# Gate (Phase 2): Python radon rank D/E/F (cc > 20); TypeScript eslint
# complexity > 20. Warn-only view surfaces the cc > 15 band for visibility.
# radon runs from an isolated, gitignored .radon-venv (or
# `python3 -m radon` when it is importable, e.g. via PYTHONPATH); the watcher
# degrades gracefully (skips, never crashes) when radon/eslint are unavailable.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="warn"
case "${1:-}" in
    --gate) MODE="gate" ;;
    --update-baseline) MODE="update" ;;
    "") MODE="warn" ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac

TARGETS=(backend/app plugins)
BASELINE=".complexity-baseline"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
RADON_JSON="$TMPDIR/radon.json"
ESLINT_JSON="$TMPDIR/eslint.json"

# --- radon resolution ----------------------------------------------------
# Oracle pin (#2138, decided 2026-07-31): the complexity verdict depends on
# the radon version, and a drifting oracle is dangerous in the silent
# downward direction. The gate therefore measures with radon==$RADON_PIN or
# not at all; a foreign version is refused, never silently used. (The
# build-derived oracles - the Tailwind classname gates - stay deliberately
# unpinned: there the build output IS the test subject.)
RADON_PIN="6.0.1"
export RADON_PIN
RADON_VENV="${RADON_VENV:-$ROOT/.radon-venv}"
RADON=()
if command -v radon >/dev/null 2>&1; then
    RADON=(radon)
elif [ -x "$RADON_VENV/bin/radon" ]; then
    RADON=("$RADON_VENV/bin/radon")
elif python3 -c "import radon" >/dev/null 2>&1; then
    RADON=(python3 -m radon)
else
    echo "Bootstrapping radon into $RADON_VENV ..."
    if python3 -m venv "$RADON_VENV" 2>/dev/null \
        && "$RADON_VENV/bin/pip" install --quiet --upgrade pip "radon==$RADON_PIN" 2>/dev/null; then
        RADON=("$RADON_VENV/bin/radon")
    fi
fi

# Enforce the pin on whatever was resolved (PATH, venv, import, bootstrap).
if [ "${#RADON[@]}" -gt 0 ]; then
    RADON_RESOLVED="$(("${RADON[@]}" --version 2>/dev/null || echo unavailable) | head -1)"
    if [ "$RADON_RESOLVED" != "$RADON_PIN" ]; then
        if [ "$MODE" = "gate" ] && [ "${COMPLEXITY_GATE_ALLOW_PARTIAL:-0}" != "1" ]; then
            echo "ERROR: resolved radon '$RADON_RESOLVED' does not match the pinned radon==$RADON_PIN" >&2
            echo "       - the gate cannot verify Python complexity with a foreign analyzer (#2138)." >&2
            echo "       Fix: align the PATH radon, or rm -rf $RADON_VENV to re-bootstrap the pin." >&2
            exit 1
        fi
        echo "radon '$RADON_RESOLVED' != pinned $RADON_PIN - this run's Python reading is off-pin." >&2
    fi
fi

# Produce the radon JSON (rank E and worse) once; empty object on failure.
#
# FAIL-CLOSED in gate mode (#2083): "no analyzer" must never read as "no
# offenders". In warn mode the watcher still degrades gracefully, but a GATE
# that cannot analyse anything may not report success - that is the fail-open
# class this contract exists for. Set COMPLEXITY_GATE_ALLOW_PARTIAL=1 to
# accept a deliberately partial run.
echo "{}" > "$RADON_JSON"
if [ "${#RADON[@]}" -gt 0 ]; then
    if ! "${RADON[@]}" cc "${TARGETS[@]}" --min D -j > "$RADON_JSON" 2>/dev/null; then
        echo "{}" > "$RADON_JSON"
        if [ "$MODE" = "gate" ] && [ "${COMPLEXITY_GATE_ALLOW_PARTIAL:-0}" != "1" ]; then
            echo "ERROR: radon failed - the gate cannot verify Python complexity." >&2
            echo "       Refusing to report success (set COMPLEXITY_GATE_ALLOW_PARTIAL=1 to override)." >&2
            exit 1
        fi
    fi
elif [ "$MODE" = "gate" ] && [ "${COMPLEXITY_GATE_ALLOW_PARTIAL:-0}" != "1" ]; then
    echo "ERROR: radon unavailable - the gate cannot verify Python complexity." >&2
    echo "       Refusing to report success (set COMPLEXITY_GATE_ALLOW_PARTIAL=1 to override)." >&2
    exit 1
else
    echo "radon unavailable - Python complexity is skipped this run." >&2
fi

# A ratchet without its baseline cannot ratchet: an absent baseline would make
# every offender look "new" (or, with an empty scan, make everything look
# clean). Gate mode demands the file (#2083).
if [ "$MODE" = "gate" ] && [ ! -f "$BASELINE" ]; then
    echo "ERROR: $BASELINE is missing - a ratchet gate without its baseline" >&2
    echo "       cannot decide anything. Run 'make check-complexity-gate-update'." >&2
    exit 1
fi

# --- eslint JSON (only needed for gate / update) -------------------------
# FAIL-CLOSED in gate mode, like radon above (#3438): a missing or crashed
# eslint used to become "[]", which read as "no TypeScript offenders" and
# printed "Complexity gate passed". The gate also refuses output that is not
# a JSON array and a run that linted zero files, and it reports how many
# files eslint looked at (gate contract points 3 and 4, #2083).
ESLINT_LINTED="skipped"
export ESLINT_LINTED

eslint_cannot_measure() {
    echo "[]" > "$ESLINT_JSON"
    if [ "$MODE" = "gate" ] && [ "${COMPLEXITY_GATE_ALLOW_PARTIAL:-0}" != "1" ]; then
        echo "ERROR: $1 - the gate cannot verify TypeScript complexity." >&2
        echo "       Refusing to report success (set COMPLEXITY_GATE_ALLOW_PARTIAL=1 to override)." >&2
        exit 1
    fi
    echo "$1 - TypeScript complexity is skipped this run." >&2
}

produce_eslint_json() {
    echo "[]" > "$ESLINT_JSON"
    if [ ! -d frontend/node_modules ]; then
        eslint_cannot_measure "frontend/node_modules missing"
        return
    fi
    # eslint exits 1 when other rules report errors; the JSON is still
    # complete. 2 and above means it could not lint.
    local status=0
    (
        cd frontend
        npx --no-install eslint src --rule 'complexity: ["warn", 20]' \
            --format json
    ) > "$ESLINT_JSON" 2>"$TMPDIR/eslint.err" || status=$?
    if [ "$status" -gt 1 ]; then
        cat "$TMPDIR/eslint.err" >&2
        eslint_cannot_measure "eslint exited $status"
        return
    fi
    local linted
    if ! linted="$(python3 -c 'import json, sys
report = json.load(open(sys.argv[1], encoding="utf-8"))
if not isinstance(report, list):
    raise SystemExit(1)
print(len(report))' "$ESLINT_JSON" 2>/dev/null)"; then
        eslint_cannot_measure "eslint output is not a JSON array"
        return
    fi
    if [ "$linted" -eq 0 ]; then
        eslint_cannot_measure "eslint linted 0 files"
        return
    fi
    ESLINT_LINTED="$linted"
}

case "$MODE" in
    warn)
        if [ "${#RADON[@]}" -gt 0 ]; then
            echo "== Radon: average + cyclomatic complexity (rank B and worse) =="
            "${RADON[@]}" cc "${TARGETS[@]}" -a -nb || true
            echo
            echo "== Radon: functions with cc > 15 (warn-only) =="
            "${RADON[@]}" cc "${TARGETS[@]}" --min C -j 2>/dev/null \
                | python3 "$ROOT/scripts/radon_warn.py"
        fi
        echo
        echo "== ESLint: frontend complexity (threshold 15, warn-only) =="
        if [ -d frontend/node_modules ]; then
            ( cd frontend && npx --no-install eslint src \
                --rule 'complexity: ["warn", 15]' ) || true
        else
            echo "frontend/node_modules missing - run 'npm ci' in frontend/."
        fi
        exit 0
        ;;
    update)
        produce_eslint_json
        RADON_VERSION="$(("${RADON[@]}" --version 2>/dev/null || echo unavailable) | head -1)" \
        python3 "$ROOT/scripts/complexity_gate.py" \
            --radon-json "$RADON_JSON" --eslint-json "$ESLINT_JSON" \
            --baseline "$BASELINE" --update-baseline
        exit $?
        ;;
    gate)
        produce_eslint_json
        RADON_VERSION="$(("${RADON[@]}" --version 2>/dev/null || echo unavailable) | head -1)" \
        python3 "$ROOT/scripts/complexity_gate.py" \
            --radon-json "$RADON_JSON" --eslint-json "$ESLINT_JSON" \
            --baseline "$BASELINE"
        exit $?
        ;;
esac
