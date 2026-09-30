import { describe, expect, it } from "vitest";

import { radarLabelLines } from "./radar-label";

describe("radarLabelLines (#3402)", () => {
  it.each([
    ["short label stays one line", "Deduktiv", 12, ["Deduktiv"]],
    ["breaks after a hyphen", "KI-adaptiv", 7, ["KI-", "adaptiv"]],
    ["keeps a hyphenated label that fits", "KI-adaptiv", 12, ["KI-adaptiv"]],
    ["wraps at spaces", "Παραγωγική (από γενικό)", 12, ["Παραγωγική", "(από γενικό)"]],
    ["clips one over-long word", "Fehlerzentriert", 12, ["Fehlerzentr…"]],
    ["wraps and clips together", "Centré sur l'erreur", 10, ["Centré sur", "l'erreur"]],
    ["empty label", "", 12, []],
  ])("%s", (_name, label, max, expected) => {
    expect(radarLabelLines(label, max)).toEqual(expected);
  });

  it("never returns a line longer than the limit", () => {
    for (const label of ["Tümdengelimsel", "Adaptativo por IA", "Προσαρμοστική AI"]) {
      for (const line of radarLabelLines(label, 9)) expect(line.length).toBeLessThanOrEqual(9);
    }
  });
});
