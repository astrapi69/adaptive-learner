/**
 * EXP-033 / AIV-04 — Dexie AI-validation report cache round-trip.
 * Pins save → get and the overwrite-on-resave contract against
 * fake-indexeddb.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  getAiValidationCacheDexie,
  saveAiValidationCacheDexie,
} from "./content-loader-dexie-ai";
import { _resetDbForTests, getDb } from "../dexie/db";
import type { AiValidationCacheRecord } from "../types";

const SOURCE = "astrapi69/adaptive-learner-content";
const SET_ID = "es-a1";

function record(over: Partial<AiValidationCacheRecord> = {}): AiValidationCacheRecord {
  return {
    source: SOURCE,
    set_id: SET_ID,
    set_version: "1.0.0",
    content_hash: null,
    results: [
      { card_id: "c1", ok: true, issues: [] },
      {
        card_id: "c2",
        ok: false,
        issues: [{ field: "front", problem: "p", suggestion: "s" }],
      },
    ],
    response_ids: ["chatcmpl-1"],
    provider: "openai",
    model: "gpt-4o-mini",
    card_count: 2,
    issue_count: 1,
    checked_at: "2026-06-17T12:00:00.000Z",
    ...over,
  };
}

beforeEach(async () => {
  await _resetDbForTests();
  const db = getDb();
  try {
    await db.aiValidationResults.clear();
  } catch {
    /* fresh DB */
  }
});

describe("Dexie AI-validation cache", () => {
  it("returns null when nothing is cached", async () => {
    expect(await getAiValidationCacheDexie(SOURCE, SET_ID)).toBeNull();
  });

  it("round-trips a saved record", async () => {
    await saveAiValidationCacheDexie(record());
    const got = await getAiValidationCacheDexie(SOURCE, SET_ID);
    expect(got).not.toBeNull();
    expect(got?.set_version).toBe("1.0.0");
    expect(got?.card_count).toBe(2);
    expect(got?.issue_count).toBe(1);
    expect(got?.results).toHaveLength(2);
    expect(got?.response_ids).toEqual(["chatcmpl-1"]);
  });

  it("overwrites the prior report on resave (one row per set)", async () => {
    await saveAiValidationCacheDexie(record({ set_version: "1.0.0" }));
    await saveAiValidationCacheDexie(record({ set_version: "2.0.0", issue_count: 0 }));
    const got = await getAiValidationCacheDexie(SOURCE, SET_ID);
    expect(got?.set_version).toBe("2.0.0");
    expect(got?.issue_count).toBe(0);
    expect(await getDb().aiValidationResults.count()).toBe(1);
  });

  it("keys by source + set id (different sources don't collide)", async () => {
    await saveAiValidationCacheDexie(record({ source: "user/repo-a" }));
    await saveAiValidationCacheDexie(record({ source: "user/repo-b" }));
    expect(await getAiValidationCacheDexie("user/repo-a", SET_ID)).not.toBeNull();
    expect(await getAiValidationCacheDexie("user/repo-b", SET_ID)).not.toBeNull();
    expect(await getDb().aiValidationResults.count()).toBe(2);
  });
});
