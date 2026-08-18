/**
 * EXP-046 item 4 / #2655 — fork-provenance unit tests.
 *
 * Covers the three exported helpers in isolation: stamping variation_of,
 * building the carried-forward attribution, and the display credit line.
 */

import { describe, expect, it } from "vitest";

import {
  buildForkAttribution,
  forkCreditLine,
  stampVariationOf,
  withVariationOf,
} from "./fork-provenance";
import type { ContentLesson, SetAttribution } from "../../../storage/types";

function lesson(over: Partial<ContentLesson> = {}): ContentLesson {
  return { id: "01-greetings", title: "Greetings", steps: [], ...over } as ContentLesson;
}

describe("stampVariationOf", () => {
  it("points every lesson's variation_of at its own (unchanged) id", () => {
    const lessons = [lesson({ id: "01-greetings" }), lesson({ id: "02-numbers" })];
    const result = stampVariationOf(lessons);
    expect(result.map((l) => l.variation_of)).toEqual(["01-greetings", "02-numbers"]);
  });

  it("does not mutate the input lessons", () => {
    const original = lesson();
    stampVariationOf([original]);
    expect(original.variation_of).toBeUndefined();
  });

  it("overwrites an existing variation_of with the immediate fork parent", () => {
    // A lesson forked a second time already carries a variation_of from
    // the FIRST fork; the new fork records ITS immediate parent, not the
    // deeper lineage (bounded, single-step link per the schema).
    const result = stampVariationOf([lesson({ id: "01-greetings", variation_of: "elsewhere" })]);
    expect(result[0].variation_of).toBe("01-greetings");
  });
});

describe("withVariationOf", () => {
  it("stamps the given original id, distinct from the lesson's own (fresh) id", () => {
    const result = withVariationOf(lesson({ id: "fresh-id" }), "01-greetings");
    expect(result.id).toBe("fresh-id");
    expect(result.variation_of).toBe("01-greetings");
  });
});

describe("buildForkAttribution", () => {
  it("carries the source set's attribution forward unchanged", () => {
    const source: SetAttribution = {
      author: "Original Author",
      derived_from: [{ author: "Even Earlier" }],
    };
    expect(buildForkAttribution(source, [])).toEqual(source);
  });

  it("synthesizes attribution from the first lesson's contributed_by when the set has none", () => {
    const lessons = [lesson({ contributed_by: null }), lesson({ contributed_by: "Jane Doe" })];
    expect(buildForkAttribution(null, lessons)).toEqual({ author: "Jane Doe" });
  });

  it("returns null when neither the set nor any lesson carries a credit", () => {
    expect(buildForkAttribution(null, [lesson(), lesson()])).toBeNull();
    expect(buildForkAttribution(undefined, [])).toBeNull();
  });

  it("ignores a blank/whitespace-only contributed_by", () => {
    expect(buildForkAttribution(null, [lesson({ contributed_by: "   " })])).toBeNull();
  });

  it("bounds an over-long derived_from chain to 8 entries, keeping the origin", () => {
    const chain = Array.from({ length: 10 }, (_, i) => ({ author: `Author ${i}` }));
    const source: SetAttribution = { author: "Current", derived_from: chain };
    const result = buildForkAttribution(source, []);
    expect(result?.derived_from).toHaveLength(8);
    // The origin (first entry) always survives the bound.
    expect(result?.derived_from?.[0]).toEqual({ author: "Author 0" });
    // The most recent entry survives too.
    expect(result?.derived_from?.at(-1)).toEqual({ author: "Author 9" });
  });

  it("leaves a chain already within the 8-entry bound untouched", () => {
    const chain = Array.from({ length: 8 }, (_, i) => ({ author: `Author ${i}` }));
    const source: SetAttribution = { author: "Current", derived_from: chain };
    expect(buildForkAttribution(source, [])?.derived_from).toEqual(chain);
  });
});

describe("forkCreditLine", () => {
  const t = (_key: string, fallback?: string) => fallback ?? "";

  it("returns null when there is no attribution", () => {
    expect(forkCreditLine(null, t)).toBeNull();
    expect(forkCreditLine(undefined, t)).toBeNull();
  });

  it("names the author directly when the chain has no further steps", () => {
    expect(forkCreditLine({ author: "Original Author" }, t)).toBe("Based on Original Author");
  });

  it("collapses to the origin author plus 'and others' for a multi-step chain", () => {
    const attribution: SetAttribution = {
      author: "Current",
      derived_from: [{ author: "Origin Author" }, { author: "Middle Author" }],
    };
    expect(forkCreditLine(attribution, t)).toBe("Based on Origin Author and others");
  });
});
