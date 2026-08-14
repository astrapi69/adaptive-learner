/**
 * Drift guard for CURRENT_MANIFEST_SCHEMA_VERSION (companion to
 * lesson-export.test.ts / repo-export.test.ts, which check the two export
 * writers use it). This test checks the constant itself: it must track
 * schema/content-manifest.schema.json's declared default, so a re-mirror
 * that bumps the default fails HERE instead of the exported schema_version
 * silently drifting behind the mirror again.
 */

import { describe, expect, it } from "vitest";

import manifestSchema from "../../../../schema/content-manifest.schema.json";
import { CURRENT_MANIFEST_SCHEMA_VERSION } from "./schema-version";

describe("CURRENT_MANIFEST_SCHEMA_VERSION vs the schema mirror", () => {
  it("matches schema/content-manifest.schema.json's declared default", () => {
    expect(CURRENT_MANIFEST_SCHEMA_VERSION).toBe(manifestSchema.properties.schema_version.default);
  });
});
