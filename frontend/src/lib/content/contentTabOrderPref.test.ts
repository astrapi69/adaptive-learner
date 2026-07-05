/**
 * contentTabOrderPref (#1378) — typed, robust ordering of the Content tabs.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_TAB_ORDER,
  moveContentTab,
  readContentTabOrder,
  sanitizeContentTabOrder,
  setContentTabOrder,
  type ContentTabId,
} from "./contentTabOrderPref";

const KEY = "adaptive-learner.content.tab_order";

afterEach(() => {
  localStorage.clear();
});

describe("sanitizeContentTabOrder (robustness)", () => {
  it("keeps a full valid order as-is", () => {
    expect(sanitizeContentTabOrder(["my", "import", "discover"])).toEqual([
      "my",
      "import",
      "discover",
    ]);
  });

  it("drops unknown IDs and appends missing known tabs at the end", () => {
    // "my" first, "bogus" dropped, missing "discover"/"import" appended in
    // default order.
    expect(sanitizeContentTabOrder(["my", "bogus"])).toEqual([
      "my",
      "discover",
      "import",
    ]);
  });

  it("removes duplicates", () => {
    expect(sanitizeContentTabOrder(["my", "my", "discover"])).toEqual([
      "my",
      "discover",
      "import",
    ]);
  });

  it("falls back to the full default order for a non-array / empty / all-unknown value", () => {
    expect(sanitizeContentTabOrder(null)).toEqual(DEFAULT_CONTENT_TAB_ORDER);
    expect(sanitizeContentTabOrder([])).toEqual(DEFAULT_CONTENT_TAB_ORDER);
    expect(sanitizeContentTabOrder(["x", "y"])).toEqual(
      DEFAULT_CONTENT_TAB_ORDER,
    );
    expect(sanitizeContentTabOrder("garbage")).toEqual(
      DEFAULT_CONTENT_TAB_ORDER,
    );
  });
});

describe("read/write persistence", () => {
  it("defaults when nothing is stored", () => {
    expect(readContentTabOrder()).toEqual(DEFAULT_CONTENT_TAB_ORDER);
  });

  it("persists an order and re-reads it (survives a 'reload')", () => {
    setContentTabOrder(["import", "my", "discover"]);
    expect(readContentTabOrder()).toEqual(["import", "my", "discover"]);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([
      "import",
      "my",
      "discover",
    ]);
  });

  it("sanitizes a hand-corrupted stored value on read", () => {
    localStorage.setItem(KEY, JSON.stringify(["my", "nope"]));
    expect(readContentTabOrder()).toEqual(["my", "discover", "import"]);
  });

  it("returns the default on malformed JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readContentTabOrder()).toEqual(DEFAULT_CONTENT_TAB_ORDER);
  });
});

describe("moveContentTab", () => {
  const base: ContentTabId[] = ["discover", "my", "import"];

  it("moves a tab up", () => {
    expect(moveContentTab(base, "my", -1)).toEqual([
      "my",
      "discover",
      "import",
    ]);
  });

  it("moves a tab down", () => {
    expect(moveContentTab(base, "my", 1)).toEqual([
      "discover",
      "import",
      "my",
    ]);
  });

  it("is a no-op past the ends", () => {
    expect(moveContentTab(base, "discover", -1)).toEqual(base);
    expect(moveContentTab(base, "import", 1)).toEqual(base);
  });
});
