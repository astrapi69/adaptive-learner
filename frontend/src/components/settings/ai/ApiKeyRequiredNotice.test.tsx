/**
 * #1133 — the "API key required" notice links to the AI settings tab
 * (?tab=ai), where provider keys live, not the General tab.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import {MemoryRouter} from "react-router-dom";

import ApiKeyRequiredNotice from "./ApiKeyRequiredNotice";
import {I18nProvider} from "../../../hooks/ui/useI18n";

function renderNotice() {
    return render(
        <I18nProvider>
            <MemoryRouter>
                <ApiKeyRequiredNotice feature="to analyze conversations" />
            </MemoryRouter>
        </I18nProvider>,
    );
}

describe("ApiKeyRequiredNotice (#1133)", () => {
    it("links to the AI settings tab, not General", () => {
        renderNotice();
        const link = screen.getByRole("link");
        expect(link.getAttribute("href")).toBe("/settings?tab=ai");
    });
});
