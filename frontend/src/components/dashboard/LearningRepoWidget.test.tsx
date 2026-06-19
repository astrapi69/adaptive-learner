/** Vitest pins for the Dashboard's Learning Repository widget. */

import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it} from "vitest";

import {I18nProvider} from "../../hooks/ui/useI18n";
import LearningRepoWidget from "./LearningRepoWidget";

function wrap(projectId: string) {
    return render(
        <MemoryRouter>
            <I18nProvider>
                <LearningRepoWidget projectId={projectId} />
            </I18nProvider>
        </MemoryRouter>,
    );
}

describe("LearningRepoWidget", () => {
    it("renders the dashboard card with title + subtitle + link", () => {
        wrap("proj-123");
        expect(screen.getByTestId("learning-repo-widget")).toBeInTheDocument();
        const link = screen.getByTestId("learning-repo-widget-link");
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute(
            "href",
            "/projects/proj-123/learning-repo",
        );
    });

    it("encodes special characters in the projectId on the link target", () => {
        wrap("a/b c");
        const link = screen.getByTestId("learning-repo-widget-link");
        expect(link.getAttribute("href")).toBe(
            "/projects/a%2Fb%20c/learning-repo",
        );
    });
});
