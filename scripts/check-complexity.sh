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
        && "$RADON_VENV/bin/pip" install --quiet --upgrade pip radon 2>/dev/null; then
        RADON=("$RADON_VENV/bin/radon")
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
produce_eslint_json() {
    echo "[]" > "$ESLINT_JSON"
    if [ -d frontend/node_modules ]; then
        (
            cd frontend
            npx --no-install eslint src --rule 'complexity: ["warn", 20]' \
                --format json
        ) > "$ESLINT_JSON" 2>/dev/null || true
        [ -s "$ESLINT_JSON" ] || echo "[]" > "$ESLINT_JSON"
    else
        echo "frontend/node_modules missing - TypeScript complexity is skipped." >&2
    fi
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
