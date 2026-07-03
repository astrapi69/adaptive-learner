/** Tests for the Discover source-language preference (#1343). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DISCOVER_SOURCE_LANGUAGE_CHANGE_EVENT,
  DISCOVER_SOURCE_LANGUAGE_KEY,
  readDiscoverSourceLanguage,
  writeDiscoverSourceLanguage,
} from "./discoverLanguagePref";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("readDiscoverSourceLanguage", () => {
  it("returns null when unset (→ caller uses the locale default)", () => {
    expect(readDiscoverSourceLanguage()).toBeNull();
  });

  it("returns an explicit language code", () => {
    localStorage.setItem(DISCOVER_SOURCE_LANGUAGE_KEY, "el");
    expect(readDiscoverSourceLanguage()).toBe("el");
  });

  it('distinguishes an explicit "all languages" ("") from unset (null)', () => {
    localStorage.setItem(DISCOVER_SOURCE_LANGUAGE_KEY, "");
    expect(readDiscoverSourceLanguage()).toBe("");
    expect(readDiscoverSourceLanguage()).not.toBeNull();
  });
});

describe("writeDiscoverSourceLanguage", () => {
  it("persists the choice and notifies same-tab listeners", () => {
    const spy = vi.fn();
    window.addEventListener(DISCOVER_SOURCE_LANGUAGE_CHANGE_EVENT, spy);
    writeDiscoverSourceLanguage("de");
    expect(localStorage.getItem(DISCOVER_SOURCE_LANGUAGE_KEY)).toBe("de");
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(DISCOVER_SOURCE_LANGUAGE_CHANGE_EVENT, spy);
  });

  it("persists an explicit empty string (all languages)", () => {
    writeDiscoverSourceLanguage("");
    expect(readDiscoverSourceLanguage()).toBe("");
  });
});
