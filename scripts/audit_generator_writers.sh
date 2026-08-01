#!/usr/bin/env bash
# One-off audit (#2265): which committed file is written by more than one
# generator? Runs each generator in turn and attributes every TRACKED file it
# touches by mtime, then reports paths with two or more writers.
#
# Empirical on purpose: a static grep over write calls cannot resolve the path
# expressions, and the whole point of the finding is that two writers agreed by
# accident - an inferred answer would repeat the mistake.
set -u
cd "$(dirname "$0")/.."

MARK=$(mktemp)
OUT=$(mktemp)

run_and_attribute() {
    local label="$1"; shift
    touch "$MARK"
    sleep 0.05
    "$@" >/dev/null 2>&1
    git ls-files -z | while IFS= read -r -d '' f; do
        [ "$f" -nt "$MARK" ] && printf '%s\t%s\n' "$f" "$label"
    done >> "$OUT"
}

run_and_attribute sync-versions          python3 scripts/sync_versions.py
run_and_attribute sync-plugin-config     python3 scripts/sync_plugin_config_to_frontend.py
run_and_attribute sync-help              python3 scripts/sync_help_to_frontend.py
run_and_attribute sync-praise            python3 scripts/sync_praise_to_frontend.py
run_and_attribute sync-missions          python3 scripts/sync_missions_to_frontend.py
run_and_attribute sync-i18n              python3 scripts/sync_i18n_to_frontend.py
run_and_attribute sync-mkdocs-nav        python3 scripts/generate_mkdocs_nav.py
run_and_attribute schema-mirror-engine   python3 scripts/sync_schema_mirror_from_engine.py
run_and_attribute schema-generator       env -C backend poetry run python ../scripts/generate_lesson_schema.py
run_and_attribute schema-pydantic        env -C backend poetry run python ../scripts/generate_pydantic_models.py
run_and_attribute schema-mirror-ajv      env -C frontend node scripts/sync-schema-mirror.mjs
run_and_attribute schema-validator       env -C frontend node scripts/generate-lesson-validator.mjs

echo "=== files touched, by writer count ==="
sort "$OUT" | uniq | awk -F'\t' '{c[$1]++; w[$1]=w[$1]" "$2} END {for (f in c) printf "%d\t%s\t%s\n", c[f], f, w[f]}' | sort -rn
echo
echo "=== generators audited: 12 ==="
echo "=== tracked files scanned per generator: $(git ls-files | wc -l) ==="
rm -f "$MARK" "$OUT"
