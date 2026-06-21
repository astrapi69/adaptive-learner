import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ToolRecommendations from "./ToolRecommendations";
import type {ToolRecommendation} from "../../types";

const RECS: ToolRecommendation[] = [
    {
        name: "Anki",
        url: "https://apps.ankiweb.net/",
        why: "Spaced repetition.",
        weight_keys: ["deductive", "error_based"],
        score: 0.8,
    },
    {
        name: "NotebookLM",
        url: "https://notebooklm.google.com/",
        why: "Active recall.",
        weight_keys: ["inductive"],
        score: 0.6,
    },
];

describe("ToolRecommendations", () => {
    it("renders a card per tool with the name, why, method chips", () => {
        render(<ToolRecommendations tools={RECS} />);
        expect(screen.getByTestId("tool-recs")).toBeInTheDocument();
        expect(screen.getByTestId("tool-Anki")).toBeInTheDocument();
        expect(screen.getByTestId("tool-NotebookLM")).toBeInTheDocument();
        expect(screen.getByText("Spaced repetition.")).toBeInTheDocument();
    });

    it("links every tool name to its url", () => {
        render(<ToolRecommendations tools={RECS} />);
        const link = screen.getByText("Anki").closest("a") as HTMLAnchorElement;
        expect(link.href).toBe("https://apps.ankiweb.net/");
        expect(link.target).toBe("_blank");
        expect(link.rel).toContain("noreferrer");
        expect(link.rel).toContain("noopener");
    });

    it("renders the empty state with an empty array", () => {
        render(<ToolRecommendations tools={[]} />);
        expect(screen.getByTestId("tool-recs-empty")).toBeInTheDocument();
    });
});
