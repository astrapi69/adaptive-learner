/**
 * SettingsDisclosure tests (#2959): collapsed by default, the click
 * opens the body + flips aria-expanded, the open state is remembered
 * per storage key, a throwing storage falls back to the default, and
 * the children stay MOUNTED while collapsed (the #1459 order pin walks
 * hidden descendants, so folding must never unmount).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsDisclosure } from "./SettingsDisclosure";

const KEY = "adaptive-learner.settings.test_details_open";

function renderDisclosure(extra: { defaultOpen?: boolean } = {}) {
  return render(
    <SettingsDisclosure
      title="More details"
      hint="What the fold contains"
      storageKey={KEY}
      testid="disclosure-test"
      {...extra}
    >
      <input data-testid="disclosure-inner-input" />
    </SettingsDisclosure>,
  );
}

describe("SettingsDisclosure", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("is collapsed by default, with the title, the hint and aria-expanded=false", () => {
    renderDisclosure();
    const toggle = screen.getByTestId("disclosure-test-toggle");
    expect(toggle).toHaveTextContent("More details");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("What the fold contains")).toBeInTheDocument();
    expect(screen.getByTestId("disclosure-test-body")).not.toBeVisible();
  });

  it("keeps its children mounted while collapsed", () => {
    renderDisclosure();
    expect(screen.getByTestId("disclosure-inner-input")).toBeInTheDocument();
  });

  it("click opens the body, sets aria-expanded and wires aria-controls to the body id", () => {
    renderDisclosure();
    const toggle = screen.getByTestId("disclosure-test-toggle");
    fireEvent.click(toggle);
    const body = screen.getByTestId("disclosure-test-body");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(body).toBeVisible();
    expect(body.id).not.toBe("");
    expect(toggle).toHaveAttribute("aria-controls", body.id);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(body).not.toBeVisible();
  });

  it("persists the open state under the storage key", () => {
    renderDisclosure();
    fireEvent.click(screen.getByTestId("disclosure-test-toggle"));
    expect(localStorage.getItem(KEY)).toBe("true");
    fireEvent.click(screen.getByTestId("disclosure-test-toggle"));
    expect(localStorage.getItem(KEY)).toBe("false");
  });

  it("reads a persisted open state on mount", () => {
    localStorage.setItem(KEY, "true");
    renderDisclosure();
    expect(screen.getByTestId("disclosure-test-toggle")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("disclosure-test-body")).toBeVisible();
  });

  it("honours defaultOpen when nothing is stored", () => {
    renderDisclosure({ defaultOpen: true });
    expect(screen.getByTestId("disclosure-test-toggle")).toHaveAttribute("aria-expanded", "true");
  });

  it("falls back to the default when the storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    renderDisclosure({ defaultOpen: true });
    const toggle = screen.getByTestId("disclosure-test-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(() => fireEvent.click(toggle)).not.toThrow();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
