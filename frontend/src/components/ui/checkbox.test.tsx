import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("reflects checked state via aria-checked", () => {
    render(<Checkbox checked data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveAttribute("aria-checked", "true");
  });

  it("reports the mixed state for indeterminate", () => {
    render(<Checkbox checked="indeterminate" data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveAttribute("aria-checked", "mixed");
  });

  it("toggles on click", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onChange} data-testid="c" />);
    fireEvent.click(screen.getByTestId("c"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not fire when disabled", () => {
    const onChange = vi.fn();
    render(<Checkbox checked disabled onCheckedChange={onChange} data-testid="c" />);
    fireEvent.click(screen.getByTestId("c"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
