/**
 * Tests for the Settings > Help section (Phase 38E).
 *
 * Coverage:
 *  - Renders all four category groups when the search box is
 *    empty.
 *  - Each canonical entry (curriculum, method_deductive,
 *    step_input, feature_method_switch) is reachable as a
 *    clickable row.
 *  - Search filters by title (case-insensitive substring).
 *  - Search filters by short description.
 *  - Empty result renders the no-results message.
 *  - Clicking a row opens the help drawer for that entry.
 */

import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";

import HelpBrowser from "./HelpBrowser";
import {HelpProvider, useHelp} from "../../contexts/HelpContext";

vi.mock("../../hooks/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
        setLang: vi.fn(),
    }),
}));

function HelpStateProbe() {
    const {openKey} = useHelp();
    return (
        <span data-testid="help-state-probe">
            {openKey ?? ""}
        </span>
    );
}

describe("HelpBrowser", () => {
    it("renders all four category groups with entries", () => {
        render(
            <HelpProvider>
                <HelpBrowser />
            </HelpProvider>,
        );
        expect(
            screen.getByTestId("settings-help-group-concepts"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("settings-help-group-methods"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("settings-help-group-steps"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("settings-help-group-features"),
        ).toBeInTheDocument();
    });

    it("renders a button for each canonical entry", () => {
        render(
            <HelpProvider>
                <HelpBrowser />
            </HelpProvider>,
        );
        for (const key of [
            "curriculum",
            "method_deductive",
            "step_input",
            "feature_method_switch",
        ]) {
            expect(
                screen.getByTestId(`settings-help-entry-${key}`),
            ).toBeInTheDocument();
        }
    });

    it("filters entries by title (case-insensitive)", () => {
        render(
            <HelpProvider>
                <HelpBrowser />
            </HelpProvider>,
        );
        const search = screen.getByTestId("settings-help-search");
        fireEvent.change(search, {target: {value: "curri"}});
        // Curriculum entry is still visible.
        expect(
            screen.getByTestId("settings-help-entry-curriculum"),
        ).toBeInTheDocument();
        // Unrelated entries are filtered out.
        expect(
            screen.queryByTestId("settings-help-entry-method_dialogic"),
        ).not.toBeInTheDocument();
    });

    it("filters entries by short description", () => {
        render(
            <HelpProvider>
                <HelpBrowser />
            </HelpProvider>,
        );
        const search = screen.getByTestId("settings-help-search");
        // ``method_dialogic`` short text includes "conversation".
        fireEvent.change(search, {target: {value: "conversation"}});
        expect(
            screen.getByTestId("settings-help-entry-method_dialogic"),
        ).toBeInTheDocument();
    });

    it("renders the no-results message when nothing matches", () => {
        render(
            <HelpProvider>
                <HelpBrowser />
            </HelpProvider>,
        );
        const search = screen.getByTestId("settings-help-search");
        fireEvent.change(search, {
            target: {value: "qzxqxzqxz-no-such-entry"},
        });
        expect(
            screen.getByTestId("settings-help-no-results"),
        ).toBeInTheDocument();
    });

    it("clicking a row opens the help drawer for that entry", () => {
        render(
            <HelpProvider>
                <HelpBrowser />
                <HelpStateProbe />
            </HelpProvider>,
        );
        expect(
            screen.getByTestId("help-state-probe").textContent,
        ).toBe("");
        fireEvent.click(
            screen.getByTestId("settings-help-entry-curriculum"),
        );
        expect(
            screen.getByTestId("help-state-probe").textContent,
        ).toBe("curriculum");
    });
});
