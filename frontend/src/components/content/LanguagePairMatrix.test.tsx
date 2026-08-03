/** Tests for the EXP-048 #2337 language-pair matrix (alternative entry). */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LanguagePairMatrix, {
  type LanguagePairOption,
} from "./LanguagePairMatrix";

const PAIRS: LanguagePairOption[] = [
  { source: "de", target: "es", count: 3 },
  { source: "de", target: "fr", count: 1 },
];

function renderMatrix(over: Partial<React.ComponentProps<typeof LanguagePairMatrix>> = {}) {
  const onSelect = vi.fn();
  render(
    <LanguagePairMatrix
      pairs={PAIRS}
      heading="Sprachpaare"
      formatLabel={(p) => `${p.source} → ${p.target} (${p.count})`}
      selectLabel={(l) => `Wähle ${l}`}
      onSelect={onSelect}
      testId="pm"
      {...over}
    />,
  );
  return { onSelect };
}

describe("LanguagePairMatrix", () => {
  it("renders one button per pair with the formatted label", () => {
    renderMatrix();
    expect(screen.getByTestId("pm-de-es")).toHaveTextContent("de → es (3)");
    expect(screen.getByTestId("pm-de-fr")).toHaveTextContent("de → fr (1)");
  });

  it("calls onSelect with the clicked pair", () => {
    const { onSelect } = renderMatrix();
    fireEvent.click(screen.getByTestId("pm-de-es"));
    expect(onSelect).toHaveBeenCalledWith({ source: "de", target: "es", count: 3 });
  });

  it("marks the active pair aria-pressed and leaves the others unpressed", () => {
    renderMatrix({ activePair: { source: "de", target: "es" } });
    expect(screen.getByTestId("pm-de-es")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("pm-de-fr")).toHaveAttribute("aria-pressed", "false");
  });

  it("renders nothing when there are no pairs", () => {
    const { container } = render(
      <LanguagePairMatrix
        pairs={[]}
        heading="Sprachpaare"
        formatLabel={() => ""}
        selectLabel={() => ""}
        onSelect={() => {}}
        testId="pm"
      />,
    );
    expect(container.querySelector('[data-testid="pm"]')).toBeNull();
  });
});
