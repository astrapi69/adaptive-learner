/**
 * ContentHub (#1378) — configurable tab order + start-tab / deep-link logic.
 *
 * The three tab pages are stubbed so we assert the hub's own tab bar + active
 * selection, not the page internals.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./Discover", () => ({
  default: () => <div data-testid="page-discover" />,
}));
vi.mock("./Content", () => ({
  default: () => <div data-testid="page-my" />,
}));
vi.mock("./Import", () => ({
  default: () => <div data-testid="page-import" />,
}));

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
  }),
}));

import ContentHub from "./ContentHub";
import { setContentTabOrder } from "../../lib/content/contentTabOrderPref";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ContentHub />
    </MemoryRouter>,
  );
}

function tabOrder(): string[] {
  return screen
    .getAllByRole("tab")
    .map((b) => b.getAttribute("data-testid") ?? "");
}

afterEach(() => {
  localStorage.clear();
});

describe("ContentHub tab order (#1378)", () => {
  it("renders the default order and Discover as the start tab", () => {
    renderAt("/content");
    expect(tabOrder()).toEqual([
      "content-tab-discover",
      "content-tab-my",
      "content-tab-import",
    ]);
    expect(screen.getByTestId("content-tab-discover")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders the configured order", () => {
    setContentTabOrder(["my", "import", "discover"]);
    renderAt("/content");
    expect(tabOrder()).toEqual([
      "content-tab-my",
      "content-tab-import",
      "content-tab-discover",
    ]);
  });

  it("makes the first configured tab the initial active tab", () => {
    setContentTabOrder(["my", "discover", "import"]);
    renderAt("/content");
    expect(screen.getByTestId("content-tab-my")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("a ?tab deep link wins over the configured start tab", () => {
    setContentTabOrder(["my", "discover", "import"]);
    renderAt("/content?tab=import");
    expect(screen.getByTestId("content-tab-import")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("content-tab-my")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("an unknown ?tab falls back to the configured start tab", () => {
    setContentTabOrder(["import", "discover", "my"]);
    renderAt("/content?tab=bogus");
    expect(screen.getByTestId("content-tab-import")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
