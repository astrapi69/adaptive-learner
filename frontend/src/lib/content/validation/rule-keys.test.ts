/**
 * App tables keyed by engine rule id follow a renamed rule (engine 0.39.0).
 *
 * The engine always reports a finding under the rule's current id. A table
 * the app keys by rule id would silently stop matching once a rule it names
 * is renamed; these helpers lift every key to its current id.
 */

import { RENAMED_RULE_IDS } from "learn-content-engine/rules";
import { describe, expect, it } from "vitest";

import { currentRuleIdSet, keyedByCurrentRuleId } from "./rule-keys";

const [RETIRED, CURRENT] = Object.entries(RENAMED_RULE_IDS)[0];

describe("keyedByCurrentRuleId", () => {
  it("finds a value keyed by a retired id under the current id", () => {
    const table = keyedByCurrentRuleId({ [RETIRED]: "code" });
    expect(table[CURRENT]).toBe("code");
    expect(table[RETIRED]).toBeUndefined();
  });

  it("keeps a current id as it is", () => {
    expect(keyedByCurrentRuleId({ "E-CARD-REF": "card_ref" })).toEqual({ "E-CARD-REF": "card_ref" });
  });
});

describe("currentRuleIdSet", () => {
  it("holds the current id for a retired one", () => {
    const ids = currentRuleIdSet([RETIRED, "W-DOMAIN-UNKNOWN"]);
    expect([...ids].sort()).toEqual([CURRENT, "W-DOMAIN-UNKNOWN"].sort());
  });
});
