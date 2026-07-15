#!/usr/bin/env bash
# Byte-identity gate for the EXP-044 concern-split (#1655).
#
# Every concern-split commit must be a PURE TEXT MOVE: the CSS the build
# emits must stay byte-identical. This script makes that checkable:
#
#   scripts/check-css-identity.sh ref     build + store the reference
#                                         snapshot (run BEFORE a split)
#   scripts/check-css-identity.sh check   build + byte-compare against the
#                                         stored reference (run AFTER)
#
# The snapshot concatenates every dist/assets/*.css in a stable order,
# with the content-hash part of each filename normalized away (the hash
# CHANGES iff the bytes change, but the comparison should name the file,
# not just fail on the hash). Reference lives at .css-identity-ref
# (gitignored) next to a sha256 for a cheap short-circuit.
#
# Exit codes: 0 = identical / ref stored, 1 = drift (diff printed),
# 2 = operational error (missing build, missing ref).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$REPO_ROOT/frontend"
DIST_ASSETS="$FRONTEND/dist/assets"
REF_FILE="$REPO_ROOT/.css-identity-ref"
MODE="${1:-}"

if [[ "$MODE" != "ref" && "$MODE" != "check" ]]; then
    echo "usage: $0 ref|check" >&2
    exit 2
fi

echo "=== css-identity: building (VITE_STORAGE_MODE=dexie) ==="
(cd "$FRONTEND" && VITE_STORAGE_MODE=dexie bun run build >/dev/null)

if ! ls "$DIST_ASSETS"/*.css >/dev/null 2>&1; then
    echo "FEHLER: keine CSS-Assets unter frontend/dist/assets/" >&2
    exit 2
fi

snapshot() {
    # Stable order via hash-normalized names; every file prefixed with its
    # normalized name so a diff names the drifting bundle.
    for css in "$DIST_ASSETS"/*.css; do
        base="$(basename "$css")"
        norm="$(echo "$base" | sed -E 's/-[A-Za-z0-9_-]{8}\.css$/.css/')"
        printf '%s\t%s\n' "$norm" "$css"
    done | sort | while IFS=$'\t' read -r norm css; do
        printf '===== %s =====\n' "$norm"
        cat "$css"
        printf '\n'
    done
}

if [[ "$MODE" == "ref" ]]; then
    snapshot > "$REF_FILE"
    sha256sum "$REF_FILE" | awk '{print $1}' > "$REF_FILE.sha256"
    echo "OK: Referenz gespeichert ($(wc -c < "$REF_FILE") Bytes, sha256 $(cat "$REF_FILE.sha256" | cut -c1-12)...)"
    exit 0
fi

if [[ ! -f "$REF_FILE" ]]; then
    echo "FEHLER: keine Referenz (.css-identity-ref). Erst '$0 ref' auf dem VOR-Stand laufen lassen." >&2
    exit 2
fi

CURRENT="$(mktemp)"
trap 'rm -f "$CURRENT"' EXIT
snapshot > "$CURRENT"

if cmp -s "$REF_FILE" "$CURRENT"; then
    echo "OK: byte-identisch mit der Referenz ($(wc -c < "$CURRENT") Bytes)."
    exit 0
fi

echo "DRIFT: die emittierte CSS unterscheidet sich von der Referenz:" >&2
# Byte-capped, not line-capped: minified bundles are single huge lines,
# so ``head -40`` (lines) would still dump hundreds of KB.
diff "$REF_FILE" "$CURRENT" | head -c 2000 >&2
echo "" >&2
echo "(diff gekuerzt auf 2000 Bytes - voller Vergleich: diff .css-identity-ref <neuer Snapshot>)" >&2
exit 1
