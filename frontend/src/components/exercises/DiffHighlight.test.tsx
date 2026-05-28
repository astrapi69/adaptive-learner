/**
 * Tests for the DiffHighlight visual diff renderer (Phase 52B / F-112).
 *
 * Asserts the accessibility contract: every non-equal token carries an
 * aria-label and an aria-hidden icon in addition to its colour class, so
 * the surface stays usable for colourblind + screen-reader users.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DiffHighlight from "./DiffHighlight";
import { type DiffToken, tokenDiff } from "../../lib/exercises/token-diff";

describe("DiffHighlight: renders each op type", () => {
    it("renders an equal token as plain text with no a11y decoration", () => {
        const tokens: DiffToken[] = [{ text: "hello", type: "equal" }];
        render(<DiffHighlight tokens={tokens} />);
        const span = screen.getByTestId("diff-token-equal");
        expect(span).toHaveTextContent("hello");
        expect(span).toHaveAttribute("data-type", "equal");
        // Equal tokens carry no aria-label (they're not a diff signal).
        expect(span).not.toHaveAttribute("aria-label");
    });

    it("renders an insert token with + icon, aria-label, and green class", () => {
        const tokens: DiffToken[] = [{ text: "world", type: "insert" }];
        render(<DiffHighlight tokens={tokens} />);
        const span = screen.getByTestId("diff-token-insert");
        expect(span).toHaveAttribute("aria-label", "missing: world");
        expect(span).toHaveClass("diff-token-insert");
        const icon = within(span).getByText("+");
        expect(icon).toHaveAttribute("aria-hidden", "true");
        expect(span).toHaveTextContent("+world");
    });

    it("renders a delete token with × icon, aria-label, and red class", () => {
        const tokens: DiffToken[] = [{ text: "wrong", type: "delete" }];
        render(<DiffHighlight tokens={tokens} />);
        const span = screen.getByTestId("diff-token-delete");
        expect(span).toHaveAttribute("aria-label", "extra: wrong");
        expect(span).toHaveClass("diff-token-delete");
        const icon = within(span).getByText("×");
        expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    it("renders a replace token with user-strike, arrow, and expected", () => {
        const tokens: DiffToken[] = [
            { text: "cafe", type: "replace", expected: "café" },
        ];
        render(<DiffHighlight tokens={tokens} />);
        const span = screen.getByTestId("diff-token-replace");
        expect(span).toHaveAttribute("aria-label", "wrote cafe, expected café");
        expect(span).toHaveClass("diff-token-replace");
        expect(within(span).getByText("cafe")).toHaveClass("diff-token-user-word");
        expect(within(span).getByText("café")).toHaveClass("diff-token-expected-word");
        const arrow = within(span).getByText("→");
        expect(arrow).toHaveAttribute("aria-hidden", "true");
    });
});

describe("DiffHighlight: whitespace handling", () => {
    it("preserves trailing space outside the insert decoration", () => {
        const tokens: DiffToken[] = [
            { text: "a", type: "equal" },
            { text: "b ", type: "insert" },
            { text: "c", type: "equal" },
        ];
        const { container } = render(<DiffHighlight tokens={tokens} />);
        // The trailing space sits BETWEEN the insert wrapper and "c", not
        // inside the green badge — the visual result is "a [+b] c".
        const span = screen.getByTestId("diff-token-insert");
        expect(within(span).getByText("b")).toBeInTheDocument();
        // Confirm the rendered text reads "ab c" with the trailing space outside.
        expect(container.textContent).toMatch(/\+b c$/);
    });

    it("preserves trailing space outside the replace decoration", () => {
        const tokens: DiffToken[] = [
            { text: "x ", type: "replace", expected: "y" },
            { text: "z", type: "equal" },
        ];
        const { container } = render(<DiffHighlight tokens={tokens} />);
        expect(container.textContent).toMatch(/z$/);
    });
});

describe("DiffHighlight: integration with tokenDiff", () => {
    it("paints a full sentence diff end-to-end", () => {
        const tokens = tokenDiff("Je vois le chat", "Je vois un chat");
        render(<DiffHighlight tokens={tokens} />);
        const wrapper = screen.getByTestId("diff-highlight");
        // 4 tokens: equal(Je), equal(vois), replace(le→un), equal(chat)
        expect(within(wrapper).getAllByTestId("diff-token-equal")).toHaveLength(3);
        const replace = within(wrapper).getByTestId("diff-token-replace");
        expect(replace).toHaveAttribute("aria-label", "wrote le, expected un");
    });

    it("paints a delete-only diff (no replace pairing without anchor)", () => {
        const tokens = tokenDiff("foo bar", "baz qux");
        render(<DiffHighlight tokens={tokens} />);
        const wrapper = screen.getByTestId("diff-highlight");
        // No equal anchor → raw 2 deletes + 2 inserts, NO replace pairs.
        expect(within(wrapper).queryByTestId("diff-token-replace")).toBeNull();
        expect(within(wrapper).getAllByTestId("diff-token-delete")).toHaveLength(2);
        expect(within(wrapper).getAllByTestId("diff-token-insert")).toHaveLength(2);
    });

    it("renders empty tokens array without crashing", () => {
        render(<DiffHighlight tokens={[]} />);
        expect(screen.getByTestId("diff-highlight")).toBeInTheDocument();
    });
});

describe("DiffHighlight: outer wrapper", () => {
    it("accepts a className that merges onto the wrapper", () => {
        render(<DiffHighlight tokens={[]} className="lesson-summary-diff" />);
        const wrapper = screen.getByTestId("diff-highlight");
        expect(wrapper).toHaveClass("diff-highlight");
        expect(wrapper).toHaveClass("lesson-summary-diff");
    });
});
