#!/usr/bin/env node
/**
 * Copy the canonical lesson JSON-Schema to the bundle-local ajv mirror (#1205).
 *
 * TS lesson TYPES are no longer generated here - since D1b (#1521) the app
 * imports them from ``learn-content-engine`` (the canonical schema + type
 * source). This script only keeps the RUNTIME ajv schema mirror in sync.
 *
 * Input:  schema/lesson.schema.json (byte-parity-gated against the pinned
 *         learn-content-engine release; see check_engine_schema_parity.py).
 * Output: frontend/src/lib/content/validation/lesson.schema.generated.json
 *
 * The runtime ajv validator (``lesson-schema-validator.ts``) cannot read the
 * repo-root ``schema/lesson.schema.json`` from inside the browser bundle, so
 * this mirror lives under ``src/`` and is imported directly. It is written
 * BYTE-IDENTICAL to the source artefact and gated by ``--check``. Do NOT edit
 * by hand.
 *
 * Usage:
 *   node scripts/sync-schema-mirror.mjs           # write
 *   node scripts/sync-schema-mirror.mjs --check   # exit 1 on drift
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCHEMA_PATH = join(REPO_ROOT, "schema", "lesson.schema.json");
const SCHEMA_MIRROR_PATH = join(
  REPO_ROOT,
  "frontend/src/lib/content/validation/lesson.schema.generated.json",
);

/** Read a file, returning "" when it does not exist yet. */
function readOrEmpty(path) {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

const check = process.argv.includes("--check");
const schemaText = readFileSync(SCHEMA_PATH, "utf-8");

if (check) {
  if (readOrEmpty(SCHEMA_MIRROR_PATH) !== schemaText) {
    console.error(
      "Bundle-local lesson schema mirror out of date. Run `make sync-schema-mirror`.",
    );
    process.exit(1);
  }
  console.log("Lesson schema mirror up to date.");
} else {
  writeFileSync(SCHEMA_MIRROR_PATH, schemaText, "utf-8");
  console.log(`Wrote ${SCHEMA_MIRROR_PATH}`);
}
