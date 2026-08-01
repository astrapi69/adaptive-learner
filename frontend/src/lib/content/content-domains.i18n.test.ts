/**
 * EXP-048 / #2320 — every content domain the app knows about MUST carry a
 * ``discover.domain.<domain>`` label in the bundled runtime catalogue, so the
 * Discover domain facet never shows a raw identifier ("dog-training" instead
 * of "Hundetraining"). Reads the generated EN JSON (the Dexie-mode runtime
 * source of truth, like ``i18n-sync.test.ts``); ``make sync-i18n`` regenerates
 * it from ``backend/config/i18n/en.yaml``.
 *
 * Measured live coverage before this fix (EXP-048 Teil 1): 4 of 9 present
 * domains labelled; ``dog-training`` / ``technology`` / ``software`` /
 * ``philosophy`` / ``traffic-knowledge`` fell through as raw identifiers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DOMAIN_OPTIONS } from "./content-domains";

const en = JSON.parse(
  readFileSync(join(__dirname, "../../data/i18n/en.json"), "utf-8"),
) as { discover?: { domain?: Record<string, string> } };

describe("discover.domain labels (EXP-048 #2320)", () => {
  it("labels every known content domain (no raw identifiers in the facet)", () => {
    const labels = en.discover?.domain ?? {};
    const missing = DOMAIN_OPTIONS.filter((domain) => !labels[domain]);
    expect(missing).toEqual([]);
  });
});
