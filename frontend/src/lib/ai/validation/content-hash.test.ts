import { describe, it, expect } from "vitest";

import { computeContentHash, canonicalCardString } from "./content-hash";

const CARDS = [
  { id: "c2", front: "casa", back: "Haus" },
  { id: "c1", front: "libro", back: "Buch", notes: "maskulin" },
];

describe("computeContentHash", () => {
  it("produces a sha256: prefixed hex string", async () => {
    const hash = await computeContentHash(CARDS);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("is deterministic for the same cards", async () => {
    expect(await computeContentHash(CARDS)).toBe(await computeContentHash(CARDS));
  });

  it("is order-independent (sorted by id)", async () => {
    const reordered = [CARDS[1], CARDS[0]];
    expect(await computeContentHash(CARDS)).toBe(await computeContentHash(reordered));
  });

  it("treats null/absent notes identically", async () => {
    const a = await computeContentHash([{ id: "x", front: "a", back: "b" }]);
    const b = await computeContentHash([{ id: "x", front: "a", back: "b", notes: null }]);
    expect(a).toBe(b);
  });

  it("changes when a card field changes", async () => {
    const before = await computeContentHash(CARDS);
    const after = await computeContentHash([
      CARDS[0],
      { ...CARDS[1], front: "el libro" },
    ]);
    expect(after).not.toBe(before);
  });

  it("changes when a card is added", async () => {
    const before = await computeContentHash(CARDS);
    const after = await computeContentHash([...CARDS, { id: "c3", front: "x", back: "y" }]);
    expect(after).not.toBe(before);
  });
});

describe("canonicalCardString", () => {
  it("sorts by id, drops whitespace, and normalises notes", () => {
    const s = canonicalCardString(CARDS);
    expect(s).toBe(
      '[{"id":"c1","front":"libro","back":"Buch","notes":"maskulin"},' +
        '{"id":"c2","front":"casa","back":"Haus","notes":""}]',
    );
  });
});
