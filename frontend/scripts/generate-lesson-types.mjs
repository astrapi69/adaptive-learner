#!/usr/bin/env node
/**
 * Generate TypeScript interfaces from the App-authoritative lesson JSON
 * Schema (EXP-039, Direction A).
 *
 * Source of truth: schema/lesson.schema.json (itself generated from the
 * Pydantic models by `make sync-schema`). This script derives TS types from
 * that schema via json-schema-to-typescript, so the type definitions cannot
 * drift from the runtime validator.
 *
 * Output: frontend/src/storage/types/content/lesson-schema.generated.ts
 *
 * Usage (from the frontend/ directory so json-schema-to-typescript resolves):
 *   node scripts/generate-lesson-types.mjs           # write
 *   node scripts/generate-lesson-types.mjs --check   # exit 1 on drift
 */
import { compile } from "json-schema-to-typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCHEMA_PATH = join(REPO_ROOT, "schema", "lesson.schema.json");
const OUT_PATH = join(
  REPO_ROOT,
  "frontend/src/storage/types/content/lesson-schema.generated.ts",
);

const BANNER = `/**
 * GENERATED from schema/lesson.schema.json via
 * scripts/generate_lesson_types.mjs (EXP-039). DO NOT EDIT.
 *
 * Source of truth is the Pydantic model
 * (adaptive_learner_content_loader.schema). Edit the model, run
 * \`make sync-schema\`, then \`make sync-lesson-types\`.
 */`;

/**
 * Strip ``minItems`` / ``maxItems`` from every array node in the schema,
 * in place. json-schema-to-typescript turns a bounded array into a tuple
 * union (``[] | [T] | [T, T] | …``), which is correct for validation but
 * useless as a CONSUMER type: a plain ``T[]`` is not assignable to such a
 * union, so the ~147 lesson-type consumers (and any code constructing a
 * lesson) would not type-check. Array cardinality is the JSON-Schema
 * validator's job (the committed ``*.schema.json`` keep min/maxItems for
 * ajv); the generated TS types only need the element type. So we drop the
 * bounds before compiling and emit clean ``T[]`` arrays.
 */
function stripArrayBounds(node) {
  if (Array.isArray(node)) {
    for (const child of node) stripArrayBounds(child);
    return;
  }
  if (node && typeof node === "object") {
    if (node.type === "array") {
      delete node.minItems;
      delete node.maxItems;
    }
    for (const value of Object.values(node)) stripArrayBounds(value);
  }
}

async function build() {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
  // Drop the custom x-schema-version key so json2ts does not emit a stray type.
  delete schema["x-schema-version"];
  stripArrayBounds(schema);
  const ts = await compile(schema, "Lesson", {
    bannerComment: BANNER,
    additionalProperties: false,
    declareExternallyReferenced: true,
    style: { singleQuote: false, semi: true },
  });
  return ts;
}

const check = process.argv.includes("--check");
const generated = await build();

if (check) {
  let current = "";
  try {
    current = readFileSync(OUT_PATH, "utf-8");
  } catch {
    current = "";
  }
  if (current !== generated) {
    console.error(
      "Lesson TS types out of date. Run `make sync-lesson-types`.",
    );
    process.exit(1);
  }
  console.log("Lesson TS types up to date.");
} else {
  writeFileSync(OUT_PATH, generated, "utf-8");
  console.log(`Wrote ${OUT_PATH}`);
}
