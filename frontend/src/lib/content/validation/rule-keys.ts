/**
 * Keys app tables by the CURRENT engine rule id (engine 0.39.0).
 *
 * The engine reports a finding under the rule's current id, and records each
 * retired id in ``RENAMED_RULE_IDS``. A table the app keys by rule id would
 * stop matching once a rule it names is renamed; lifting its keys through
 * ``currentRuleId`` keeps it matching without anyone noticing the rename.
 *
 * @example
 * const CODE_BY_RULE = keyedByCurrentRuleId({ "E-CARD-REF": "card_ref" });
 * CODE_BY_RULE[finding.id];
 */

import { currentRuleId } from "learn-content-engine/rules";

/** The table with every key lifted to its current rule id. */
export function keyedByCurrentRuleId<V>(table: Readonly<Record<string, V>>): Readonly<Record<string, V>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(table).map(([id, value]) => [currentRuleId(id), value])),
  );
}

/** The rule ids, each lifted to its current id. */
export function currentRuleIdSet(ids: Iterable<string>): ReadonlySet<string> {
  return new Set([...ids].map((id) => currentRuleId(id)));
}
