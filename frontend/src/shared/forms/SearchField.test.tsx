import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SearchField from "./SearchField";

describe("SearchField", () => {
  it("renders a controlled input with the placeholder as the accessible name", () => {
    render(<SearchField value="" onChange={() => {}} placeholder="Spanisch, KI…" />);
    const input = screen.getByTestId("search-field");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Spanisch, KI…");
    expect(input).toHaveAccessibleName("Spanisch, KI…");
  });

  it("emits onChange with the typed value", () => {
    const onChange = vi.fn();
    render(<SearchField value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId("search-field"), { target: { value: "spanisch" } });
    expect(onChange).toHaveBeenCalledWith("spanisch");
  });

  it("shows a clear button only when clearLabel + value are set, and clears", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchField value="x" onChange={onChange} />);
    expect(screen.queryByTestId("search-field-clear")).toBeNull(); // no clearLabel

    rerender(<SearchField value="x" onChange={onChange} clearLabel="Clear" />);
    const clear = screen.getByTestId("search-field-clear");
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith("");

    rerender(<SearchField value="" onChange={onChange} clearLabel="Clear" />);
    expect(screen.queryByTestId("search-field-clear")).toBeNull(); // empty value
  });
});
