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
    domain: "language",
};

function setup(
    over: Partial<LessonMeta> = {},
    props: {sameLanguage?: boolean} = {},
) {
    render(
        <MetadataStep
            meta={{...meta, ...over}}
            showError={false}
            titleMissing={false}
            sameLanguage={props.sameLanguage ?? false}
            onUpdate={vi.fn()}
            onApplyTemplate={vi.fn()}
            selectedTemplate={null}
            onStartBookMode={vi.fn()}
            onStartExtensions={vi.fn()}
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

// #1716 — the content-domain selector chooses between a language pair and a
// knowledge (single content language, level-less) shape.
describe("MetadataStep content domain (#1716)", () => {
    it("always renders a domain selector", () => {
        setup();
        expect(screen.getByTestId("create-lesson-domain")).toBeInTheDocument();
    });

    it("language domain shows the source/target pair, not a content language", () => {
        setup({domain: "language"});
        expect(screen.getByTestId("create-lesson-target-lang")).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-source-lang")).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-content-lang"),
        ).not.toBeInTheDocument();
    });

    it("knowledge domain collapses to a single content language + level", () => {
        setup({domain: "psychology"});
        expect(
            screen.getByTestId("create-lesson-content-lang"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-target-lang"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-source-lang"),
        ).not.toBeInTheDocument();
        // The level control is still offered (with a No-level option).
        expect(screen.getByTestId("create-lesson-level")).toBeInTheDocument();
    });

    it("knowledge domain shows the domain hint, not the same-language hint", () => {
        setup({domain: "knowledge", sourceLanguage: "de", targetLanguage: "de"}, {
            sameLanguage: true,
        });
        expect(
            screen.getByTestId("create-lesson-domain-hint"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-same-language-hint"),
        ).not.toBeInTheDocument();
    });

    it("language domain with an equal pair shows the same-language hint", () => {
        setup({domain: "language", sourceLanguage: "de", targetLanguage: "de"}, {
            sameLanguage: true,
        });
        expect(
            screen.getByTestId("create-lesson-same-language-hint"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-domain-hint"),
        ).not.toBeInTheDocument();
    });
});
