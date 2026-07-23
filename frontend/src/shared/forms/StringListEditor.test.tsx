/**
 * Unit + a11y pins for the shared repeatable string-list editor
 * (astrapi69/adaptive-learner#1797). App-agnostic add / remove list of
 * short text values; first used for a free-text card's additional accepted
 * answers in the Lesson Creator.
 */
import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import StringListEditor from "./StringListEditor";

const LABELS = {
    label: "Additional accepted answers",
    addButtonLabel: "Add answer",
    removeItemLabel: "Remove answer",
    placeholder: "Another accepted answer",
};

describe("StringListEditor (#1797)", () => {
    it("renders the existing values as removable items", () => {
        render(
            <StringListEditor
                values={["noch Single", "alleinstehend"]}
                onChange={vi.fn()}
                {...LABELS}
            />,
        );
        expect(screen.getByText("noch Single")).toBeInTheDocument();
        expect(screen.getByText("alleinstehend")).toBeInTheDocument();
        expect(screen.getAllByRole("button", {name: "Remove answer"})).toHaveLength(2);
    });

    it("adds a trimmed value via the Add button", () => {
        const onChange = vi.fn();
        render(<StringListEditor values={["Single"]} onChange={onChange} {...LABELS} />);
        fireEvent.change(screen.getByTestId("string-list-input"), {
            target: {value: "  noch Single  "},
        });
        fireEvent.click(screen.getByTestId("string-list-add"));
        expect(onChange).toHaveBeenCalledWith(["Single", "noch Single"]);
    });

    it("adds on Enter and clears the input", () => {
        const onChange = vi.fn();
        render(<StringListEditor values={[]} onChange={onChange} {...LABELS} />);
        const input = screen.getByTestId("string-list-input") as HTMLInputElement;
        fireEvent.change(input, {target: {value: "Servus"}});
        fireEvent.keyDown(input, {key: "Enter"});
        expect(onChange).toHaveBeenCalledWith(["Servus"]);
        expect(input.value).toBe("");
    });

    it("removes the value at the clicked index", () => {
        const onChange = vi.fn();
        render(
            <StringListEditor
                values={["a", "b", "c"]}
                onChange={onChange}
                {...LABELS}
            />,
        );
        fireEvent.click(screen.getByTestId("string-list-remove-1"));
        expect(onChange).toHaveBeenCalledWith(["a", "c"]);
    });

    it("ignores blank and duplicate additions (boundary)", () => {
        const onChange = vi.fn();
        render(<StringListEditor values={["Single"]} onChange={onChange} {...LABELS} />);
        const input = screen.getByTestId("string-list-input");
        // blank
        fireEvent.change(input, {target: {value: "   "}});
        fireEvent.click(screen.getByTestId("string-list-add"));
        // duplicate (after trim)
        fireEvent.change(input, {target: {value: " Single "}});
        fireEvent.click(screen.getByTestId("string-list-add"));
        expect(onChange).not.toHaveBeenCalled();
    });
});
