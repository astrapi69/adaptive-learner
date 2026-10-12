/**
 * A set manifest may declare ``metadata.type_migrations`` (engine 0.40.0,
 * engine#254); the hub will declare 105 of them. The app must read such a
 * manifest as it reads any other: ``parseManifest`` keeps the block, and the
 * pinned engine's ``validateManifest`` accepts a well-formed declaration
 * while still reporting a malformed one.
 */

import {validateManifest} from "learn-content-engine";
import {describe, expect, it} from "vitest";

import {parseManifest} from "./index";

const MANIFEST = `
schema_version: '1.19'
name: Griechisch
sets:
  - id: fr-a1-from-el
    title: Γαλλικά A1
    target_language: fr
    source_language: el
    level: A1
    version: '1.1.0'
    lesson_count: 1
metadata:
  lessons:
    - 07-erotiseis.json
  type_migrations:
    - stable_id: ex-erotiseis-8
      from: cloze
      to: multiple_choice
    - stable_id: ex-erotiseis-9
      from: cloze
      to: free_text
`;

describe("metadata.type_migrations (engine#254)", () => {
    it("is kept by parseManifest next to the lesson list", () => {
        const parsed = parseManifest(MANIFEST);
        expect(parsed?.metadata?.lessons).toEqual(["07-erotiseis.json"]);
        expect(parsed?.metadata?.type_migrations).toHaveLength(2);
    });

    it("passes the pinned engine's validateManifest", () => {
        const verdict = validateManifest(parseManifest(MANIFEST));
        expect(verdict.errors).toEqual([]);
        expect(verdict.valid).toBe(true);
    });

    it("still reports a transition the engine does not allow", () => {
        const verdict = validateManifest(
            parseManifest(MANIFEST.replace("to: free_text", "to: matching")),
        );
        expect(verdict.valid).toBe(false);
        expect(verdict.errors.map((error) => error.id)).toContain("E-TYPE-MIGRATION-PAIR");
    });
});
