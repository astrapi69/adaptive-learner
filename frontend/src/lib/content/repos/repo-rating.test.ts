/**
 * Tests for local-only per-repo star ratings (EXP-023 Phase C slice).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRepoRating,
  readRepoRating,
  writeRepoRating,
} from "./repo-rating";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});

describe("repo rating store", () => {
  it("defaults to 0 (unrated)", () => {
    expect(readRepoRating("jane/a")).toBe(0);
  });

  it("writes + reads a 1-5 rating, isolated per source", () => {
    writeRepoRating("jane/a", 4);
    writeRepoRating("bob/b", 2);
    expect(readRepoRating("jane/a")).toBe(4);
    expect(readRepoRating("bob/b")).toBe(2);
  });

  it("clamps out-of-range values and rounds", () => {
    writeRepoRating("jane/a", 9);
    expect(readRepoRating("jane/a")).toBe(5);
    writeRepoRating("jane/a", 3.6);
    expect(readRepoRating("jane/a")).toBe(4);
  });

  it("0 (or clear) removes the rating", () => {
    writeRepoRating("jane/a", 5);
    writeRepoRating("jane/a", 0);
    expect(readRepoRating("jane/a")).toBe(0);
    writeRepoRating("jane/a", 3);
    clearRepoRating("jane/a");
    expect(readRepoRating("jane/a")).toBe(0);
  });
});
