/**
 * Unit + a11y pins for the shared touch-friendly options control
 * (astrapi69/adaptive-learner#1341). Extracted from the onboarding wizard's
 * proven-on-iPhone radio-button pattern and reused for canonical
 * multiple-choice (cloze select-mode) so no native `<select>` is rendered.
 *
 * Locks the contract both consumers rely on: radiogroup semantics, tap →
 * onChange, visible selected state, disabled vs. locked, graded
 * correct/wrong colouring, 2-column layout, and long-text wrapping. The
 * a11y shape (role="radiogroup" + role="radio" + aria-checked, native
 * `<button>` keyboard focus) is what the C6 axe-core gate verifies at the
 * page level; here we pin it at the component level.
 */
import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ChoiceButtonGroup from "./ChoiceButtonGroup";

const OPTIONS = ["un", "le", "la", "les"];

describe("ChoiceButtonGroup (#1341)", () => {
    it("renders a labelled radiogroup of radio buttons (no native <select>)", () => {
        const {container} = render(
            <ChoiceButtonGroup
                options={OPTIONS}
                value={null}
                onChange={vi.fn()}
                ariaLabel="Choose the article"
                groupTestId="choices"
            />,
        );
        const group = screen.getByRole("radiogroup", {name: "Choose the article"});
        expect(group).toBe(screen.getByTestId("choices"));
        expect(container.querySelector("select")).toBeNull();
        const radios = within(group).getAllByRole("radio");
        expect(radios.map((r) => r.textContent)).toEqual(OPTIONS);
        // Native <button> → keyboard-focusable + Enter/Space activation.
        for (const r of radios) expect(r.tagName).toBe("BUTTON");
    });

    it("marks the selected value with aria-checked + data-selected", () => {
        render(
            <ChoiceButtonGroup
                options={OPTIONS}
                value="la"
                onChange={vi.fn()}
                ariaLabel="Articles"
            />,
        );
        const selected = screen.getByRole("radio", {name: "la"});
        expect(selected).toHaveAttribute("aria-checked", "true");
        expect(selected).toHaveAttribute("data-selected", "true");
        const other = screen.getByRole("radio", {name: "un"});
        expect(other).toHaveAttribute("aria-checked", "false");
        expect(other).not.toHaveAttribute("data-selected");
    });

    it("calls onChange with the option value on tap", () => {
        const onChange = vi.fn();
        render(
            <ChoiceButtonGroup
                options={OPTIONS}
                value={null}
                onChange={onChange}
                ariaLabel="Articles"
            />,
        );
        fireEvent.click(screen.getByRole("radio", {name: "les"}));
        expect(onChange).toHaveBeenCalledWith("les");
    });

    it("uses `label` for display but reports `value`", () => {
        const onChange = vi.fn();
        render(
            <ChoiceButtonGroup
                options={[{value: "3m", label: "3 months"}]}
                value={null}
                onChange={onChange}
                ariaLabel="Timeframe"
            />,
        );
        fireEvent.click(screen.getByRole("radio", {name: "3 months"}));
        expect(onChange).toHaveBeenCalledWith("3m");
    });

    it("when `disabled`, buttons are disabled and taps are ignored", () => {
        const onChange = vi.fn();
        render(
            <ChoiceButtonGroup
                options={OPTIONS}
                value={null}
                onChange={onChange}
                ariaLabel="Articles"
                disabled
            />,
        );
        const btn = screen.getByRole("radio", {name: "un"});
        expect(btn).toBeDisabled();
        fireEvent.click(btn);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("when `locked`, it is inert (aria-disabled, removed from tab order) but not greyed", () => {
        const onChange = vi.fn();
        render(
            <ChoiceButtonGroup
                options={OPTIONS}
                value="un"
                onChange={onChange}
                ariaLabel="Articles"
                locked
            />,
        );
        const btn = screen.getByRole("radio", {name: "un"});
        expect(btn).toHaveAttribute("aria-disabled", "true");
        expect(btn).toHaveAttribute("tabindex", "-1");
        // Locked is NOT the greyed `disabled` state (feedback stays vivid).
        expect(btn).not.toBeDisabled();
        fireEvent.click(btn);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("colours graded options via stateFor (correct + wrong)", () => {
        render(
            <ChoiceButtonGroup
                options={OPTIONS}
                value="le"
                onChange={vi.fn()}
                ariaLabel="Articles"
                locked
                stateFor={(v) =>
                    v === "un" ? "correct" : v === "le" ? "wrong" : undefined
                }
            />,
        );
        expect(screen.getByRole("radio", {name: "un"})).toHaveAttribute(
            "data-state",
            "correct",
        );
        expect(screen.getByRole("radio", {name: "le"})).toHaveAttribute(
            "data-state",
            "wrong",
        );
        expect(screen.getByRole("radio", {name: "la"})).not.toHaveAttribute(
            "data-state",
        );
    });

    it("lays out in two columns from the sm breakpoint when columns=2", () => {
        render(
            <ChoiceButtonGroup
                options={OPTIONS}
                value={null}
                onChange={vi.fn()}
                ariaLabel="Articles"
                columns={2}
                groupTestId="choices"
            />,
        );
        expect(screen.getByTestId("choices").className).toMatch(/sm:grid-cols-2/);
    });

    it("wraps long option text instead of truncating", () => {
        render(
            <ChoiceButtonGroup
                options={[
                    "Ein sehr langer Antworttext, der über mehrere Zeilen umbrechen muss",
                ]}
                value={null}
                onChange={vi.fn()}
                ariaLabel="Articles"
            />,
        );
        const long = screen.getByRole("radio", {name: /sehr langer Antworttext/});
        expect(long.className).toMatch(/break-words/);
        expect(long.className).toMatch(/whitespace-normal/);
    });
});
