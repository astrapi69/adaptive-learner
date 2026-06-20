#!/usr/bin/env bash
# check-folder-size.sh — folder-size CI guard (prevents god-folders).
#
# Thin alias around the canonical #809 god-folder guard
# (scripts/check-directory-size.sh) so a single implementation + a single
# whitelist (.dirsize-baseline) stay the source of truth. Counts FLAT
# (maxdepth 1) tracked *.ts/*.tsx SOURCE files per directory under
# frontend/src and fails when a NOT-whitelisted directory exceeds the
# threshold (default 15). Co-located *.test.* / *.spec.* files do not count.
#
# Usage:
#   scripts/check-folder-size.sh           # gate mode: exit 1 on a new offender
#   scripts/check-folder-size.sh --warn     # warn-only view (never fails)
#
# Whitelist (tolerated, not-yet-migrated god-folders) lives in
# .dirsize-baseline; see .folder-size-whitelist for the pointer.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-}" in
    --warn)
        exec bash "$SCRIPT_DIR/check-directory-size.sh"
        ;;
    "" | --gate)
        exec bash "$SCRIPT_DIR/check-directory-size.sh" --gate
        ;;
    *)
        echo "usage: $0 [--gate|--warn]" >&2
        exit 2
        ;;
esac
