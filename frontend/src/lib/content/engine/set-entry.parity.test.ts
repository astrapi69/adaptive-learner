/**
 * Cross-language parity for the set-entry projection (#3711).
 *
 * A manifest set entry reaches the app through two projections written by
 * hand: the engine's ``asContentSetEntry`` here (Dexie mode) and
 * ``SetEntryResponse.from_entry`` over the content-loader's ``ContentSet``
 * (API mode). ``engine-parity-check`` compares schema bytes only and sees
 * neither. Both sides run the SAME case file,
 * ``tests/fixtures/set-entry-parity/cases.json``, and compare their whole
 * output against the expected entry: field set, values, and absence. A
 * field added to one projection without a case fails here or in
 * ``backend/tests/test_set_entry_parity.py``.
 *
 * The case file is hand-written from the manifest contract, never
 * regenerated from either implementation.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ContentSetSource } from "../../../storage/types";
import { asContentSetEntry, type ParsedSet } from "./index";

const CASES_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "tests",
  "fixtures",
  "set-entry-parity",
  "cases.json",
);

interface ParityCase {
  name: string;
  entry: Record<string, unknown>;
  expected: Record<string, unknown>;
  ts?: { outcome: "rejected" } | { outcome: "projected"; overrides: Record<string, unknown> };
}

interface CaseFile {
  context: {
    source: string;
    branch: string;
    cached_version: string | null;
    downloaded_at: string | null;
  };
  only_in: Record<string, "ts" | "python">;
  cases: ParityCase[];
}

const file = JSON.parse(readFileSync(CASES_PATH, "utf-8")) as CaseFile;

/** The expected entry as this side sees it: fields owned by the other side
 *  dropped, declared overrides applied. */
function expectedForTs(c: ParityCase): Record<string, unknown> {
  const expected: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(c.expected)) {
    if (file.only_in[field] !== "python") expected[field] = value;
  }
  if (c.ts?.outcome === "projected") Object.assign(expected, c.ts.overrides);
  return expected;
}

describe("set-entry projection parity, engine side (#3711)", () => {
  it("reads a non-empty case file", () => {
    expect(file.cases.length).toBeGreaterThan(0);
  });

  it.each(file.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const src = {
      source: file.context.source,
      branch: file.context.branch,
    } as ContentSetSource;
    const project = () =>
      asContentSetEntry(
        src,
        structuredClone(c.entry) as unknown as ParsedSet,
        file.context.cached_version,
        file.context.downloaded_at,
      );
    if (c.ts?.outcome === "rejected") {
      expect(project).toThrow();
      return;
    }
    // toStrictEqual: an absent field and an undefined one differ, and so do
    // an extra field and a missing one.
    expect(JSON.parse(JSON.stringify(project()))).toStrictEqual(expectedForTs(c));
  });
});
