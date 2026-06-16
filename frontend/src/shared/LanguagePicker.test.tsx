/**
 * Tests for the reusable LanguagePicker (EXP-027 / I18N-04):
 * filtering, keyboard nav, selection, escape, grouping, a11y labels.
 */

import {describe, it, expect, vi, beforeEach} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";

import LanguagePicker, {type LanguagePickerOption} from "./LanguagePicker";

const FEW: LanguagePickerOption[] = [
    {value: "en", nativeLabel: "English", localizedLabel: "English", group: "Latin"},
    {value: "de", nativeLabel: "Deutsch", localizedLabel: "German", group: "Latin"},
    {value: "ja", nativeLabel: "日本語", localizedLabel: "Japanese", group: "CJK"},
    {value: "el", nativeLabel: "Ελληνικά", localizedLabel: "Greek", group: "Greek"},
];

function setup(overrides: Partial<React.ComponentProps<typeof LanguagePicker>> = {}) {
    const onChange = overrides.onChange ?? vi.fn();
    render(
        <LanguagePicker
            languages={overrides.languages ?? FEW}
            selectedValue={overrides.selectedValue ?? "de"}
            onChange={onChange}
            ariaLabel="Display language"
            searchPlaceholder="Search languages…"
            noResultsLabel="No languages found"
            {...overrides}
        />,
    );
    return {onChange};
}

beforeEach(() => cleanup());

describe("LanguagePicker", () => {
    it("shows the selected language on the trigger", () => {
        setup();
        const trigger = screen.getByTestId("language-picker-trigger");
        expect(trigger).toHaveTextContent("Deutsch");
        expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
        expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("opens the listbox on trigger click and focuses the search", () => {
        setup();
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        expect(screen.getByTestId("language-picker-listbox")).toBeInTheDocument();
        const search = screen.getByTestId("language-picker-search");
        expect(search).toHaveAttribute("role", "combobox");
        expect(document.activeElement).toBe(search);
    });

    it("marks the current language with aria-selected", () => {
        setup();
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        expect(
            screen.getByTestId("language-picker-option-de"),
        ).toHaveAttribute("aria-selected", "true");
        expect(
            screen.getByTestId("language-picker-option-en"),
        ).toHaveAttribute("aria-selected", "false");
    });

    it("filters as the user types (diacritic-insensitive)", () => {
        setup();
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        fireEvent.change(screen.getByTestId("language-picker-search"), {
            target: {value: "greek"},
        });
        expect(screen.getByTestId("language-picker-option-el")).toBeInTheDocument();
        expect(
            screen.queryByTestId("language-picker-option-de"),
        ).not.toBeInTheDocument();
    });

    it("filters by native label ignoring accents", () => {
        setup();
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        // "ελληνικα" without final-accent still matches "Ελληνικά".
        fireEvent.change(screen.getByTestId("language-picker-search"), {
            target: {value: "ελληνικα"},
        });
        expect(screen.getByTestId("language-picker-option-el")).toBeInTheDocument();
    });

    it("shows the no-results message when nothing matches", () => {
        setup();
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        fireEvent.change(screen.getByTestId("language-picker-search"), {
            target: {value: "zzz"},
        });
        expect(
            screen.getByTestId("language-picker-no-results"),
        ).toHaveTextContent("No languages found");
    });

    it("selects via keyboard: ArrowDown then Enter", () => {
        const {onChange} = setup({selectedValue: "en"});
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        const search = screen.getByTestId("language-picker-search");
        // Opens with the selected option (en, index 0) active; one
        // ArrowDown moves to de (index 1).
        fireEvent.keyDown(search, {key: "ArrowDown"});
        fireEvent.keyDown(search, {key: "Enter"});
        expect(onChange).toHaveBeenCalledWith("de");
    });

    it("Home / End jump to the first / last option", () => {
        const {onChange} = setup({selectedValue: "de"});
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        const search = screen.getByTestId("language-picker-search");
        fireEvent.keyDown(search, {key: "End"});
        fireEvent.keyDown(search, {key: "Enter"});
        expect(onChange).toHaveBeenCalledWith("el");
    });

    it("exposes aria-activedescendant on the search input", () => {
        setup({selectedValue: "en"});
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        const search = screen.getByTestId("language-picker-search");
        const active = search.getAttribute("aria-activedescendant");
        expect(active).toBeTruthy();
        expect(document.getElementById(active!)).toHaveAttribute(
            "role",
            "option",
        );
    });

    it("selects on option click", () => {
        const {onChange} = setup();
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        fireEvent.click(screen.getByTestId("language-picker-option-ja"));
        expect(onChange).toHaveBeenCalledWith("ja");
    });

    it("closes on Escape without selecting", () => {
        const {onChange} = setup();
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        fireEvent.keyDown(screen.getByTestId("language-picker-search"), {
            key: "Escape",
        });
        expect(
            screen.queryByTestId("language-picker-listbox"),
        ).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("does not open when disabled", () => {
        setup({disabled: true});
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        expect(
            screen.queryByTestId("language-picker-listbox"),
        ).not.toBeInTheDocument();
    });

    it("groups by script once the list exceeds the threshold", () => {
        const many: LanguagePickerOption[] = Array.from({length: 13}, (_, i) => ({
            value: `l${i}`,
            nativeLabel: `Lang ${i}`,
            group: i % 2 === 0 ? "Latin" : "CJK",
        }));
        render(
            <LanguagePicker
                languages={many}
                selectedValue="l0"
                onChange={vi.fn()}
                ariaLabel="lang"
                groupThreshold={12}
            />,
        );
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        const groups = screen.getAllByRole("group");
        expect(groups.length).toBe(2);
        expect(groups[0]).toHaveAttribute("aria-label", "Latin");
        expect(groups[1]).toHaveAttribute("aria-label", "CJK");
    });

    it("stays flat (no groups) at or below the threshold", () => {
        setup();
        fireEvent.click(screen.getByTestId("language-picker-trigger"));
        expect(screen.queryAllByRole("group")).toHaveLength(0);
    });
});
