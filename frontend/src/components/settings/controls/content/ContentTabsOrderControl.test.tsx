/**
 * ContentTabsOrderControl (#1378) — reorder the Content tabs from Settings.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
  }),
}));

import ContentTabsOrderControl from "./ContentTabsOrderControl";
import { readContentTabOrder } from "../../../../lib/content/contentTabOrderPref";

afterEach(() => {
  localStorage.clear();
});

function itemOrder(): string[] {
  return screen
    .getAllByRole("listitem")
    .map((li) => li.getAttribute("data-testid") ?? "");
}

describe("ContentTabsOrderControl", () => {
  it("lists the tabs in the default order", () => {
    render(<ContentTabsOrderControl />);
    expect(itemOrder()).toEqual([
      "content-tabs-order-item-discover",
      "content-tabs-order-item-my",
      "content-tabs-order-item-import",
      "content-tabs-order-item-create",
    ]);
  });

  it("disables Up on the first row and Down on the last row", () => {
    render(<ContentTabsOrderControl />);
    expect(screen.getByTestId("content-tabs-up-discover")).toBeDisabled();
    expect(screen.getByTestId("content-tabs-down-create")).toBeDisabled();
  });

  it("moves a tab down and persists the new order", () => {
    render(<ContentTabsOrderControl />);
    fireEvent.click(screen.getByTestId("content-tabs-down-discover"));
    expect(itemOrder()).toEqual([
      "content-tabs-order-item-my",
      "content-tabs-order-item-discover",
      "content-tabs-order-item-import",
      "content-tabs-order-item-create",
    ]);
    expect(readContentTabOrder()).toEqual(["my", "discover", "import", "create"]);
  });

  it("lets the arrows wrap under a full-width label on narrow viewports (#3027)", () => {
    render(<ContentTabsOrderControl />);
    expect(screen.getByTestId("content-tabs-order-list")).toHaveClass(
      "list-none",
      "pl-0",
    );
    const row = screen.getByTestId("content-tabs-order-item-discover");
    expect(row).toHaveClass("flex", "flex-wrap");
    expect(row.firstElementChild).toHaveClass("min-w-0", "flex-1", "basis-40");
  });

  it("moves a tab up and persists", () => {
    render(<ContentTabsOrderControl />);
    fireEvent.click(screen.getByTestId("content-tabs-up-import"));
    expect(readContentTabOrder()).toEqual([
      "discover",
      "import",
      "my",
      "create",
    ]);
  });
});
