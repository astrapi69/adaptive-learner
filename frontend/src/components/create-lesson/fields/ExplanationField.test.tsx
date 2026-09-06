/**
 * Tests for the post-answer explanation field of the inline editors (#2992).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {describe, expect, it} from "vitest";

import ExplanationField from "./ExplanationField";
import {EXPLANATION_MAX_CHARS} from "../../../lib/exercises";

function Harness({initial}: {initial: string | null}) {
    const [value, setValue] = useState<string | null>(initial);
    return (
        <>
            <ExplanationField value={value} onChange={setValue} idPrefix="ex-1" />
            <output data-testid="value">{value ?? ""}</output>
        </>
    );
}

describe("ExplanationField (#2992)", () => {
    it("renders the textarea with the current value and a live counter", () => {
        render(<Harness initial="**Regel:** hinten." />);
        const field = screen.getByTestId("ex-1-explanation") as HTMLTextAreaElement;
        expect(field.value).toBe("**Regel:** hinten.");
        expect(field).toHaveAttribute("maxlength", String(EXPLANATION_MAX_CHARS));
        expect(screen.getByTestId("ex-1-explanation-count")).toHaveTextContent(
            `18 / ${EXPLANATION_MAX_CHARS} characters`,
        );
    });

    it("reports edits through onChange and moves the counter", () => {
        render(<Harness initial={null} />);
        fireEvent.change(screen.getByTestId("ex-1-explanation"), {
            target: {value: "abc"},
        });
        expect(screen.getByTestId("value")).toHaveTextContent("abc");
        expect(screen.getByTestId("ex-1-explanation-count")).toHaveTextContent(
            `3 / ${EXPLANATION_MAX_CHARS}`,
        );
    });

    it("offers the template only while empty and pastes the convention skeleton", () => {
        render(<Harness initial="   " />);
        fireEvent.click(screen.getByTestId("ex-1-explanation-template"));
        const value = screen.getByTestId("value").textContent ?? "";
        expect(value).toContain("**Rule:**");
        expect(value).toContain("**Word for word:**");
        expect(value).toContain("**Further examples:**");
        expect(value).toContain("**Typical mistake:**");
        expect(screen.queryByTestId("ex-1-explanation-template")).toBeNull();
    });

    it("hides the template action once the author wrote something", () => {
        render(<Harness initial="**Regel:** hinten." />);
        expect(screen.queryByTestId("ex-1-explanation-template")).toBeNull();
    });
});
