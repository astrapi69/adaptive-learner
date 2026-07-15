/**
 * Regression pin for #1667: with an empty i18n catalog (fresh profile,
 * offline, or before the catalog resolves) the template cards must show
 * readable fallback text, never raw dot-notation keys and never the bare
 * template id as a title. The `t` used here has the hook's contract
 * (explicit fallback wins, key only as last resort).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";
import MetadataStep from "./MetadataStep";

const emptyCatalogT = (key: string, fallback?: string): string => fallback ?? key;

const meta: LessonMeta = {
    title: "",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "en",
    level: "A1",
    description: "",
    author: "",
};

function setup() {
    render(
        <MetadataStep
            meta={meta}
            showError={false}
            titleMissing={false}
            sameLanguage={false}
            onUpdate={vi.fn()}
            onApplyTemplate={vi.fn()}
            t={emptyCatalogT}
        />,
    );
}

describe("MetadataStep template cards without a loaded catalog (#1667)", () => {
    it("renders readable template titles, not the bare template id", () => {
        setup();
        expect(screen.getByTestId("template-blank")).toHaveTextContent("Blank Lesson");
        expect(screen.getByTestId("template-vocabulary")).toHaveTextContent("Vocabulary List");
        expect(screen.getByTestId("template-grammar")).toHaveTextContent("Grammar Lesson");
        expect(screen.getByTestId("template-conversation")).toHaveTextContent("Conversation Practice");
    });

    it("renders readable template descriptions and never a raw dot-notation key", () => {
        setup();
        expect(screen.getByTestId("template-blank")).toHaveTextContent("add cards yourself");
        expect(screen.queryByText(/create_lesson\.templates\./)).toBeNull();
    });
});
