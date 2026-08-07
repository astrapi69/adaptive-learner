import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {describe, expect, it, vi} from "vitest";

import AssistantTypeSelector from "./AssistantTypeSelector";
import {DEFAULT_ASSISTANT_TYPES} from "../../../lib/exercises";

const t = (_k: string, fallback?: string) => fallback ?? _k;

function Harness({
    initial = [...DEFAULT_ASSISTANT_TYPES],
    onChange = vi.fn(),
}: {
    initial?: string[];
    onChange?: (types: string[]) => void;
}) {
    const [selected, setSelected] = useState(initial);
    return (
        <AssistantTypeSelector
            selected={selected}
            onChange={(types) => {
                onChange(types);
                setSelected(types);
            }}
            t={t}
        />
    );
}

describe("AssistantTypeSelector (#2510)", () => {
    it("checks the standard types by default and leaves extensions unchecked", () => {
        render(<Harness />);
        expect(screen.getByTestId("assistant-type-cloze")).toBeChecked();
        expect(screen.getByTestId("assistant-type-matching")).toBeChecked();
        expect(screen.getByTestId("assistant-type-categorization")).not.toBeChecked();
    });

    it("adds an extension type on toggle", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(screen.getByTestId("assistant-type-categorization"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toContain("ext:al-categorization");
    });

    it("greys out the asset-bound types, disabled and explained", () => {
        render(<Harness />);
        for (const slug of ["picture_choice", "image-description", "dictation"]) {
            const box = screen.getByTestId(`assistant-type-unavailable-${slug}`);
            expect(box).toBeDisabled();
            expect(box).toHaveAttribute(
                "aria-describedby",
                "assistant-type-unavailable-reason",
            );
        }
        expect(
            screen.getByTestId("assistant-type-unavailable-reason"),
        ).toBeInTheDocument();
    });

    it("blocks deselecting the last remaining type and says so (min-one)", () => {
        const onChange = vi.fn();
        render(<Harness initial={["cloze"]} onChange={onChange} />);
        // No floor hint yet.
        expect(
            screen.queryByTestId("assistant-type-floor-hint"),
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("assistant-type-cloze"));
        // The change was refused and the floor message is shown.
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByTestId("assistant-type-cloze")).toBeChecked();
        expect(
            screen.getByTestId("assistant-type-floor-hint"),
        ).toBeInTheDocument();
    });

    it("allows deselecting when more than one type is selected", () => {
        const onChange = vi.fn();
        render(<Harness initial={["cloze", "matching"]} onChange={onChange} />);
        fireEvent.click(screen.getByTestId("assistant-type-matching"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toEqual(["cloze"]);
    });
});
