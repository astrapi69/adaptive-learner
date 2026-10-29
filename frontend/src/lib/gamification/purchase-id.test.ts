/**
 * The browser derives the same purchase row id as the backend (#3445).
 *
 * Both storage modes key a purchase by ``uuid5(namespace, "<user>:<kind>:<item>")``
 * so the same purchase is the same row on every device: LAN sync skips a known
 * id, and the localStorage migration can repeat without a second row. The
 * vector below was computed with Python's ``uuid.uuid5``; the namespace is read
 * from the plugin source so the two sides cannot drift apart silently.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PURCHASE_ID_NAMESPACE, XP_PURCHASE_KINDS, purchaseId } from "./purchase-id";

const PURCHASES_PY = join(
  process.cwd(),
  "..",
  "plugins",
  "adaptive-learner-plugin-gamification",
  "adaptive_learner_gamification",
  "purchases.py",
);

describe("purchaseId (#3445)", () => {
  it("matches the Python uuid5 vector", async () => {
    expect(await purchaseId("user-1", "avatar_frame", "star")).toBe(
      "100d9c63-ed69-5bc3-a4dd-d724bdee4f39",
    );
  });

  it.each([
    ["another user", "user-2", "avatar_frame", "star"],
    ["another kind", "user-1", "mascot_variant", "star"],
    ["another item", "user-1", "avatar_frame", "accent"],
  ] as const)("changes with %s", async (_label, user, kind, item) => {
    expect(await purchaseId(user, kind, item)).not.toBe(
      "100d9c63-ed69-5bc3-a4dd-d724bdee4f39",
    );
  });

  it("is a version 5, RFC 4122 variant uuid", async () => {
    const id = await purchaseId("user-1", "arcade_game", "snake");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("uses the namespace and the item kinds the backend declares", () => {
    const source = readFileSync(PURCHASES_PY, "utf-8");
    const namespace = /PURCHASE_ID_NAMESPACE = uuid\.UUID\("([0-9a-f-]+)"\)/.exec(source);
    expect(namespace?.[1]).toBe(PURCHASE_ID_NAMESPACE);
    const kinds = /ITEM_KINDS = frozenset\(\{([^}]*)\}\)/.exec(source);
    const backendKinds = [...(kinds?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect(backendKinds.length, "no kinds parsed from purchases.py").toBeGreaterThan(0);
    expect([...backendKinds].sort()).toEqual([...XP_PURCHASE_KINDS].sort());
  });
});
