/**
 * Tests for the presentational LessonPicker (Curriculum Builder).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import LessonPicker, {type PickableLesson} from "./LessonPicker";

const lessons: PickableLesson[] = [
    {
        source: "bundled:x",
        setId: "fr-a1",
        filename: "01.json",
        label: "01 greetings",
        setTitle: "French A1",
    },
    {
        source: "bundled:x",
        setId: "es-a1",
        filename: "02.json",
        label: "02 numbers",
        setTitle: "Spanish A1",
    },
];

function renderPicker(over = {}) {
    return render(
        <LessonPicker
            availableLessons={lessons}
            searchPlaceholder="Search lessons…"
            emptyLabel="No lessons found"
            onSelect={vi.fn()}
            testId="picker"
            {...over}
        />,
    );
}

describe("LessonPicker", () => {
    it("renders every available lesson", () => {
        renderPicker();
        expect(
            screen.getByTestId("picker-item-fr-a1-01.json"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("picker-item-es-a1-02.json"),
        ).toBeInTheDocument();
    });

    it("fires onSelect with the chosen lesson triple", () => {
        const onSelect = vi.fn();
        renderPicker({onSelect});
        fireEvent.click(screen.getByTestId("picker-item-fr-a1-01.json"));
        expect(onSelect).toHaveBeenCalledWith({
            source: "bundled:x",
            setId: "fr-a1",
            filename: "01.json",
        });
    });

    it("filters by lesson label", () => {
        renderPicker();
        fireEvent.change(screen.getByTestId("picker-search"), {
            target: {value: "numbers"},
        });
        expect(screen.queryByTestId("picker-item-fr-a1-01.json")).toBeNull();
        expect(
            screen.getByTestId("picker-item-es-a1-02.json"),
        ).toBeInTheDocument();
    });

    it("filters by set title", () => {
        renderPicker();
        fireEvent.change(screen.getByTestId("picker-search"), {
            target: {value: "french"},
        });
        expect(
            screen.getByTestId("picker-item-fr-a1-01.json"),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("picker-item-es-a1-02.json")).toBeNull();
    });

    it("shows the empty label when nothing matches", () => {
        renderPicker();
        fireEvent.change(screen.getByTestId("picker-search"), {
            target: {value: "zzz"},
        });
        expect(screen.getByTestId("picker-empty")).toHaveTextContent(
            "No lessons found",
        );
    });

    // #1458 - the search input must reserve left padding for the
    // magnifier icon (pl-9 > icon at left-3 + 16px), and the icon must
    // be click-through + decorative so a click on it focuses the field.
    // The companion style guard (input-padding-layer.test.ts) ensures
    // the utility is not defeated by an unlayered global input rule.
    it("reserves left padding for the search icon and keeps the icon decorative (#1458)", () => {
        const {container} = renderPicker();
        const input = screen.getByTestId("picker-search");
        expect(input.className).toMatch(/\bpl-9\b/);
        const icon = container.querySelector("svg.pointer-events-none");
        expect(icon).not.toBeNull();
        expect(icon).toHaveAttribute("aria-hidden", "true");
    });
});
