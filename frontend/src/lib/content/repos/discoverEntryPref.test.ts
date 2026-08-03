import { beforeEach, describe, expect, it } from "vitest";

import {
  DISCOVER_ENTRY_KEY,
  readDiscoverEntry,
  writeDiscoverEntry,
} from "./discoverEntryPref";

describe("discoverEntryPref (EXP-048 #2331)", () => {
  beforeEach(() => localStorage.clear());

  it("is null when unset (caller falls back to the default entry)", () => {
    expect(readDiscoverEntry()).toBeNull();
  });

  it("stores and reads an explicit choice, including the empty 'Alles' choice", () => {
    writeDiscoverEntry("knowledge");
    expect(readDiscoverEntry()).toBe("knowledge");
    expect(localStorage.getItem(DISCOVER_ENTRY_KEY)).toBe("knowledge");
    // "" is a real explicit "Alles" choice, distinct from null.
    writeDiscoverEntry("");
    expect(readDiscoverEntry()).toBe("");
  });
});
