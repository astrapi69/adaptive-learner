import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FilterBar, { type FilterDef } from "./FilterBar";

const FILTERS: FilterDef[] = [
  {
    id: "level",
    label: "Level",
    value: "",
    options: [
      { value: "", label: "All" },
      { value: "a1", label: "A1" },
      { value: "b1", label: "B1" },
    ],
  },
  {
    id: "domain",
    label: "Domain",
    value: "ai",
    options: [
      { value: "", label: "All" },
      { value: "ai", label: "AI" },
    ],
  },
];

describe("FilterBar", () => {
  it("renders one labelled select per filter with its current value", () => {
    render(<FilterBar filters={FILTERS} onChange={() => {}} />);
    const level = screen.getByTestId("filter-bar-level");
    const domain = screen.getByTestId("filter-bar-domain");
    expect(level).toHaveAccessibleName("Level");
    expect(level).toHaveValue("");
    expect(domain).toHaveValue("ai");
  });

  it("emits onChange(id, value) on selection", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={FILTERS} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("filter-bar-level"), { target: { value: "a1" } });
    expect(onChange).toHaveBeenCalledWith("level", "a1");
  });
});
