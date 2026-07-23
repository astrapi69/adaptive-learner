/**
 * Difficulty badge (#1693): tier bucketing, accessible label, colour-blind
 * safe meter, and the null-renders-nothing contract for the pre-#1693 corpus.
 */

import "@testing-library/jest-dom/vitest";
import {describe, expect, it} from "vitest";
import {render, screen} from "@testing-library/react";

import ExerciseDifficultyBadge from "./ExerciseDifficultyBadge";
import {I18nProvider} from "../../../hooks/ui/useI18n";

function renderBadge(level: number | null) {
    return render(
        <I18nProvider>
            <ExerciseDifficultyBadge level={level} />
        </I18nProvider>,
    );
}

describe("ExerciseDifficultyBadge (#1693)", () => {
    it("reproduction: a valid level renders a labelled badge", () => {
        renderBadge(3);
        expect(screen.getByTestId("difficulty-badge")).toBeInTheDocument();
    });

    it("null renders nothing (pre-#1693 corpus)", () => {
        const {container} = renderBadge(null);
        expect(container).toBeEmptyDOMElement();
    });

    it.each([
        [1, "Easy"],
        [2, "Easy"],
        [3, "Medium"],
        [4, "Hard"],
        [5, "Hard"],
    ])("level %i is tier %s", (level, tier) => {
        renderBadge(level);
        expect(screen.getByTestId("difficulty-badge-tier")).toHaveTextContent(
            tier,
        );
    });

    it("carries an accessible label naming tier and level", () => {
        renderBadge(4);
        expect(screen.getByTestId("difficulty-badge")).toHaveAccessibleName(
            "Difficulty: Hard (4 of 5)",
        );
    });

    it("stamps the raw level as a data attribute", () => {
        renderBadge(2);
        expect(screen.getByTestId("difficulty-badge")).toHaveAttribute(
            "data-difficulty",
            "2",
        );
    });

    it("renders a 5-segment meter (never colour alone)", () => {
        const {container} = renderBadge(3);
        const badge = screen.getByTestId("difficulty-badge");
        // The decorative meter is aria-hidden; count its 5 segment spans.
        const segments = badge.querySelectorAll(
            'span[aria-hidden="true"] > span',
        );
        expect(segments).toHaveLength(5);
        expect(container).not.toBeEmptyDOMElement();
    });

    it.each([0, 6, 2.5, -1, Number.NaN])(
        "out-of-range / non-integer level %s renders nothing",
        (level) => {
            const {container} = renderBadge(level);
            expect(container).toBeEmptyDOMElement();
        },
    );
});
