/** Tests for the EXP-048 #2337 language-pair matrix, redesigned as a
 *  collapsed-by-default, source-grouped disclosure (#2359). */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LanguagePairMatrix, {
  type LanguagePairOption,
} from "./LanguagePairMatrix";

// Two source groups (en top by count, then de) so grouping + order are visible.
const PAIRS: LanguagePairOption[] = [
  { source: "en", target: "es", count: 4 },
  { source: "de", target: "es", count: 3 },
  { source: "de", target: "fr", count: 1 },
];

function renderMatrix(
  over: Partial<React.ComponentProps<typeof LanguagePairMatrix>> = {},
) {
  const onSelect = vi.fn();
  render(
    <LanguagePairMatrix
      pairs={PAIRS}
      triggerLabel="Sprachpaar wählen (3)"
      heading="Sprachpaare"
      groupLabel={(src) => src.toUpperCase()}
      pairLabel={(p) => `${p.target} (${p.count})`}
      selectLabel={(p) => `Wähle ${p.source} → ${p.target}`}
      onSelect={onSelect}
      testId="pm"
      {...over}
    />,
  );
  return { onSelect };
}

describe("LanguagePairMatrix", () => {
  it("renders nothing when there are no pairs", () => {
    const { container } = render(
      <LanguagePairMatrix
        pairs={[]}
        triggerLabel=""
        heading=""
        groupLabel={() => ""}
        pairLabel={() => ""}
        selectLabel={() => ""}
        onSelect={() => {}}
        testId="pm"
      />,
    );
    expect(container.querySelector('[data-testid="pm"]')).toBeNull();
  });

  it("is collapsed by default: the trigger shows the neutral label, no pair buttons render", () => {
    renderMatrix();
    const trigger = screen.getByTestId("pm-trigger");
    expect(trigger).toHaveTextContent("Sprachpaar wählen (3)");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("pm-de-es")).toBeNull();
    expect(screen.queryByTestId("pm-en-es")).toBeNull();
  });

  it("summarizes the active pair on the collapsed trigger", () => {
    renderMatrix({
      activeSummary: "Deutsch → Spanisch",
      activePair: { source: "de", target: "es" },
    });
    expect(screen.getByTestId("pm-trigger")).toHaveTextContent(
      "Deutsch → Spanisch",
    );
  });

  it("expands on trigger click: groups by source, headings + per-target labels appear", () => {
    renderMatrix();
    fireEvent.click(screen.getByTestId("pm-trigger"));
    expect(screen.getByTestId("pm-trigger")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    // Source-group headings.
    expect(screen.getByTestId("pm-group-en")).toHaveTextContent("EN");
    expect(screen.getByTestId("pm-group-de")).toHaveTextContent("DE");
    // Per-target button labels (source is the group heading, not repeated).
    expect(screen.getByTestId("pm-en-es")).toHaveTextContent("es (4)");
    expect(screen.getByTestId("pm-de-es")).toHaveTextContent("es (3)");
    expect(screen.getByTestId("pm-de-fr")).toHaveTextContent("fr (1)");
  });

  it("renders expanded immediately with defaultOpen", () => {
    renderMatrix({ defaultOpen: true });
    expect(screen.getByTestId("pm-trigger")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("pm-de-es")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked pair", () => {
    const { onSelect } = renderMatrix({ defaultOpen: true });
    fireEvent.click(screen.getByTestId("pm-de-es"));
    expect(onSelect).toHaveBeenCalledWith({ source: "de", target: "es", count: 3 });
  });

  it("marks the active pair aria-pressed and leaves the others unpressed", () => {
    renderMatrix({ defaultOpen: true, activePair: { source: "de", target: "es" } });
    expect(screen.getByTestId("pm-de-es")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("pm-de-fr")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("pm-en-es")).toHaveAttribute("aria-pressed", "false");
  });

  it("gives each pair button an unambiguous aria-label (source and target spoken)", () => {
    renderMatrix({ defaultOpen: true });
    expect(screen.getByTestId("pm-de-es")).toHaveAttribute(
      "aria-label",
      "Wähle de → es",
    );
  });
});
