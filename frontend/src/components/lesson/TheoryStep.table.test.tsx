/**
 * #632 — markdown tables in theory content render inside a
 * horizontal-scroll wrapper so they pick up the scoped `.lesson-theory`
 * table styling (borders / padding / header / zebra) and scroll instead
 * of overflowing on narrow viewports.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k, lang: "en"}),
}));

import TheoryStep from "./TheoryStep";
import type {ReadAloudController} from "../../hooks/lesson/useReadAloud";

const tts = {
    enabled: false,
    speaking: false,
    activeId: null,
    boundaryIndex: -1,
    speak: vi.fn(),
    stop: vi.fn(),
} as unknown as ReadAloudController;

const TABLE_MD = [
    "| Begriff | Definition |",
    "| --- | --- |",
    "| Reiz | Auslöser |",
    "| Reaktion | Antwort |",
].join("\n");

describe("TheoryStep markdown tables (#632)", () => {
    it("wraps the table in a horizontal-scroll container", () => {
        const {container} = render(
            <TheoryStep
                body={TABLE_MD}
                stepId="s1"
                tts={tts}
                lessonRewriteFn={(b) => b}
                onAnchorClick={vi.fn()}
            />,
        );
        const wrapper = container.querySelector(
            ".lesson-theory-table-wrapper",
        );
        expect(wrapper).not.toBeNull();
        // The real <table> lives inside the wrapper so the scoped
        // `.lesson-theory table` styling applies.
        expect(wrapper?.querySelector("table")).not.toBeNull();
        expect(screen.getByText("Begriff")).toBeInTheDocument();
        expect(screen.getByText("Auslöser")).toBeInTheDocument();
    });
});
