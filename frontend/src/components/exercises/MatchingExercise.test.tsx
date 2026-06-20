/**
 * Tests for the Matching exercise component
 * (Phase 44 / EXP-002 / 3C / F-106).
 *
 * Pins the tap-to-pair UX + scoring contract:
 * - Counter updates on each pair / unpair.
 * - Tapping a paired tile undoes the pair.
 * - Submit disabled until all pairs are made.
 * - Submit reports {correct, total} to the parent via
 *   onComplete with the right count.
 * - 'Try again' resets state so the user can retry.
 * - Empty pairs surface the empty-state testid.
 */

import "@testing-library/jest-dom/vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import MatchingExercise, {
    MATCHING_PAIR_COLORS,
    matchingPairColorVar,
} from "./MatchingExercise";
import type {ContentLessonExercise} from "../../storage/types";

/** Convert ``#rrggbb`` to its HSL hue (degrees) + saturation (0-1). */
function hexToHsl(hex: string): {hue: number; sat: number} {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    if (delta === 0) return {hue: 0, sat: 0};
    const sat = delta / (1 - Math.abs(2 * lightness - 1));
    let hue: number;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
    return {hue, sat};
}

const EXERCISE: ContentLessonExercise = {
    id: "ex-match",
    type: "matching",
    prompt: "Match each French word with its English translation.",
    card_ids: [],
    pairs: [
        {left: "Bonjour", right: "Hello"},
        {left: "Merci", right: "Thank you"},
        {left: "Au revoir", right: "Goodbye"},
    ],
    distractors: [],
};

beforeEach(() => {
    vi.useRealTimers();
});

describe("MatchingExercise: pair lifecycle", () => {
    it("renders the prompt + counter + columns", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        expect(screen.getByTestId("matching-prompt")).toHaveTextContent(
            "Match each French word",
        );
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /0\s*\/\s*3/,
        );
        expect(screen.getByTestId("matching-left")).toBeInTheDocument();
        expect(screen.getByTestId("matching-right")).toBeInTheDocument();
    });

    it("#692 takes no unwanted text-input focus (no field to auto-focus)", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        const active = document.activeElement;
        expect(active?.tagName).not.toBe("INPUT");
        expect(active?.tagName).not.toBe("TEXTAREA");
    });

    it("shows instructions + visible column headers (UX bugfix)", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        expect(
            screen.getByTestId("matching-instructions"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("matching-left-header"),
        ).toHaveTextContent("Term");
        expect(
            screen.getByTestId("matching-right-header"),
        ).toHaveTextContent("Translation");
    });

    it("hides the first-pair flow hint once a pair is made", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("matching-flow-hint")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(
            screen.queryByTestId("matching-flow-hint"),
        ).not.toBeInTheDocument();
    });

    it("counter increments on each tap-pair", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /1\s*\/\s*3/,
        );
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /2\s*\/\s*3/,
        );
    });

    it("tapping a paired left undoes the pair", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /1\s*\/\s*3/,
        );
        fireEvent.click(screen.getByTestId("matching-left-0"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /0\s*\/\s*3/,
        );
    });

    it("submit button disabled until all pairs made", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        const submit = screen.getByTestId("matching-submit");
        expect(submit).toBeDisabled();
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(submit).toBeDisabled();
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        expect(submit).not.toBeDisabled();
    });
});

describe("MatchingExercise: scoring + completion", () => {
    it("reports {correct, total} on submit with all correct", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        for (let i = 0; i < 3; i++) {
            fireEvent.click(screen.getByTestId(`matching-left-${i}`));
            fireEvent.click(screen.getByTestId(`matching-right-${i}`));
        }
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 3, total: 3}));
        expect(screen.getByTestId("matching-result")).toHaveTextContent(
            /3\s*\/\s*3/,
        );
    });

    it("scores wrong pairs as incorrect", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        // 0→1 (wrong), 1→0 (wrong), 2→2 (correct)
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 3}));
    });

    it("accepts duplicate right-column values regardless of which identical tile is matched (#480)", () => {
        const onComplete = vi.fn();
        // libro + coche both take "el" — the two "el" right tiles are
        // interchangeable. The right column is shuffled, so a learner
        // pairing libro with coche's "el" tile (and vice versa) is still
        // correct: both display "el".
        const dupExercise: ContentLessonExercise = {
            id: "ex-dup-value",
            type: "matching",
            prompt: "Match each noun with its article.",
            card_ids: [],
            pairs: [
                {left: "libro", right: "el"},
                {left: "coche", right: "el"},
                {left: "casa", right: "la"},
            ],
            distractors: [],
        };
        render(
            <MatchingExercise exercise={dupExercise} onComplete={onComplete} />,
        );
        // Cross-match the two identical "el" tiles: libro→pair-1's "el"
        // tile, coche→pair-0's "el" tile. Pre-#480 this scored 1/3 (the
        // index check 0!==1 / 1!==0 failed); both must now count.
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 3, total: 3}),
        );
        // The per-element SRS attempts must all be correct too.
        const scored = onComplete.mock.calls[0][0];
        expect(scored.attempts.every((a: {correct: boolean}) => a.correct)).toBe(
            true,
        );
    });

    it("stacks wrong-pair feedback inside a flex-column <li> so it can't overlap the next tile (#242)", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        // 0→1 (wrong) so left tile 0 renders the feedback block.
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        // The button and the feedback must share ONE <li> that is a flex
        // column. Pre-#242 the button was ``h-full`` in a ``grid-auto-rows:1fr``
        // row, so the sibling feedback overflowed into the next tile at 375px.
        const button = screen.getByTestId("matching-left-0");
        const feedback = screen.getByTestId("matching-feedback-0");
        const li = button.closest("li");
        expect(li).not.toBeNull();
        expect(li).toBe(feedback.closest("li"));
        expect(li!.className).toContain("flex-col");
        expect(button.className).toContain("flex-1");
        expect(button.className).not.toContain("h-full");
    });

    it("keeps pair badges visible and marks correct pairs green on BOTH sides after checking (#183)", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        for (let i = 0; i < 3; i++) {
            fireEvent.click(screen.getByTestId(`matching-left-${i}`));
            fireEvent.click(screen.getByTestId(`matching-right-${i}`));
        }
        fireEvent.click(screen.getByTestId("matching-submit"));
        // Badges persist after submit (used to vanish), once per side.
        expect(screen.getAllByTestId("matching-pair-badge-1")).toHaveLength(2);
        // Both tiles of each correct pair are flagged correct.
        expect(screen.getByTestId("matching-left-0").className).toContain(
            "is-correct",
        );
        expect(screen.getByTestId("matching-right-0").className).toContain(
            "is-correct",
        );
        // No spurious correct-partner hint when everything is right.
        expect(
            screen.queryByTestId("matching-correct-hint-0"),
        ).not.toBeInTheDocument();
    });

    it("marks wrong pairs red on both sides and shows the correct partner (#183)", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        // 0→1 (wrong), 1→0 (wrong), 2→2 (correct)
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        // The wrongly-paired left + the right it chose are both flagged wrong.
        expect(screen.getByTestId("matching-left-0").className).toContain(
            "is-wrong",
        );
        expect(screen.getByTestId("matching-right-1").className).toContain(
            "is-wrong",
        );
        // #191 — the wrong pair spells out BOTH sides: the learner picked
        // right-1 ("Thank you") for left-0, whose correct partner is "Hello".
        expect(
            screen.getByTestId("matching-your-answer-0"),
        ).toHaveTextContent("Thank you");
        expect(
            screen.getByTestId("matching-correct-hint-0"),
        ).toHaveTextContent("Hello");
        // The one correct pair stays green on both sides.
        expect(screen.getByTestId("matching-left-2").className).toContain(
            "is-correct",
        );
        expect(screen.getByTestId("matching-right-2").className).toContain(
            "is-correct",
        );
        // Badges still present after checking.
        expect(
            screen.getAllByTestId("matching-pair-badge-1").length,
        ).toBeGreaterThan(0);
    });

    it("'Try again' resets state and re-enables interaction", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        for (let i = 0; i < 3; i++) {
            fireEvent.click(screen.getByTestId(`matching-left-${i}`));
            fireEvent.click(screen.getByTestId(`matching-right-${i}`));
        }
        fireEvent.click(screen.getByTestId("matching-submit"));
        fireEvent.click(screen.getByTestId("matching-retry"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /0\s*\/\s*3/,
        );
        expect(screen.getByTestId("matching-submit")).toBeDisabled();
    });
});

describe("MatchingExercise: edge cases", () => {
    it("renders empty state when pairs is missing", () => {
        render(
            <MatchingExercise
                exercise={{
                    ...EXERCISE,
                    pairs: [],
                }}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("matching-empty")).toBeInTheDocument();
    });
});

describe("MatchingExercise: selection visibility + language labels + a11y (UX bugfix)", () => {
    it("selecting a left tile marks it is-selected + aria-pressed", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        const tile = screen.getByTestId("matching-left-0");
        expect(tile).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(tile);
        expect(tile.className).toContain("is-selected");
        expect(tile).toHaveAttribute("aria-pressed", "true");
        // Sibling left tiles are not selected.
        expect(screen.getByTestId("matching-left-1")).toHaveAttribute(
            "aria-pressed",
            "false",
        );
    });

    it("announces the current selection to screen readers", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        const status = screen.getByTestId("matching-sr-status");
        expect(status).toHaveTextContent("");
        fireEvent.click(screen.getByTestId("matching-left-0"));
        expect(status).toHaveTextContent(/Bonjour/);
    });

    it("a paired tile gets the is-paired class", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(screen.getByTestId("matching-left-0").className).toContain(
            "is-paired",
        );
    });

    it("column headers show language NAMES when the pair is known", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                targetLanguage="fr"
                sourceLanguage="en"
                onComplete={vi.fn()}
            />,
        );
        // Receptive default: left = target (fr), right = source (en).
        // The exact localised name depends on the UI language; the
        // contract is only that the generic fallbacks are replaced.
        const left = screen.getByTestId("matching-left-header");
        const right = screen.getByTestId("matching-right-header");
        expect(left).not.toHaveTextContent("Term");
        expect(right).not.toHaveTextContent("Translation");
        expect(left.textContent?.length ?? 0).toBeGreaterThan(0);
        expect(right.textContent?.length ?? 0).toBeGreaterThan(0);
    });

    it("falls back to generic labels when the language pair is unknown", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("matching-left-header")).toHaveTextContent(
            "Term",
        );
        expect(
            screen.getByTestId("matching-right-header"),
        ).toHaveTextContent("Translation");
    });
});

describe("MatchingExercise: side distinction (#108)", () => {
    it("each header carries a non-color A / B letter cue", () => {
        // The two sides are tinted via design tokens; an aria-hidden
        // letter chip in each header reinforces the distinction for
        // color-vision-deficient users (color is not the only signal).
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        const leftChip = screen
            .getByTestId("matching-left-header")
            .querySelector("[aria-hidden='true']");
        const rightChip = screen
            .getByTestId("matching-right-header")
            .querySelector("[aria-hidden='true']");
        expect(leftChip).not.toBeNull();
        expect(rightChip).not.toBeNull();
        expect(leftChip).toHaveTextContent("A");
        expect(rightChip).toHaveTextContent("B");
    });
});

describe("MatchingExercise: knowledge-domain wording (#149)", () => {
    it("uses Term / Definition + a non-translation instruction for a non-language domain", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                domain="psychology"
                targetLanguage="de"
                sourceLanguage="de"
            />,
        );
        expect(
            screen.getByTestId("matching-left-header"),
        ).toHaveTextContent("Term");
        expect(
            screen.getByTestId("matching-right-header"),
        ).toHaveTextContent("Definition");
        expect(
            screen.getByTestId("matching-instructions").textContent,
        ).not.toMatch(/translation/i);
    });

    it("treats source==target as knowledge even without an explicit domain", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                targetLanguage="de"
                sourceLanguage="de"
            />,
        );
        expect(
            screen.getByTestId("matching-right-header"),
        ).toHaveTextContent("Definition");
    });

    it("keeps the translation wording for a real language pair", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                domain="language"
                targetLanguage="es"
                sourceLanguage="de"
            />,
        );
        // Language names render when the pair is known; the generic
        // 'Definition' knowledge label must NOT appear.
        expect(
            screen.getByTestId("matching-right-header").textContent,
        ).not.toContain("Definition");
    });
});

describe("MatchingExercise: per-pair color + label (#145)", () => {
    it("matchingPairColorVar cycles through the red-free matching-pair tokens (#181)", () => {
        expect(matchingPairColorVar(0)).toBe("var(--matching-pair-1)");
        expect(matchingPairColorVar(2)).toBe("var(--matching-pair-3)");
        // Wraps after the last palette entry, never touches --chart-*
        // (which carries red in several themes).
        expect(matchingPairColorVar(MATCHING_PAIR_COLORS)).toBe(
            "var(--matching-pair-1)",
        );
        for (let slot = 0; slot < MATCHING_PAIR_COLORS * 2; slot += 1) {
            expect(matchingPairColorVar(slot)).not.toContain("--chart-");
        }
    });

    it("the --matching-pair-* palette carries no red/orange (warning) hue (#181, #199)", () => {
        // #199 — orange reads as warning/error on a correct pairing, just
        // like red (#181). Pin the whole pair palette to non-warning hues
        // so neither can creep back in. Warning band: hue <= 40 (red+orange)
        // or >= 346 (deep red), at meaningful saturation. Yellow (~45) and
        // pink (~330) stay allowed.
        // vitest always runs from frontend/ (see lessons-learned); under
        // happy-dom import.meta.url is an http URL, so resolve from cwd.
        const cssPath = join(process.cwd(), "src/styles/global.css");
        const css = readFileSync(cssPath, "utf-8");
        const matches = [
            ...css.matchAll(/--matching-pair-(\d+):\s*(#[0-9a-fA-F]{6})/g),
        ];
        expect(matches.length).toBe(MATCHING_PAIR_COLORS);
        for (const [, index, hex] of matches) {
            const {hue, sat} = hexToHsl(hex);
            const isWarning = sat > 0.2 && (hue <= 40 || hue >= 346);
            expect(
                isWarning,
                `--matching-pair-${index} (${hex}) is a red/orange warning hue (${hue.toFixed(0)} deg)`,
            ).toBe(false);
        }
    });

    it("labels both tiles of a matched pair with the same number", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        // Pair the first left term with its correct right tile.
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        // Both tiles now carry the pair-1 badge (color + number).
        expect(
            screen.getAllByTestId("matching-pair-badge-1"),
        ).toHaveLength(2);
    });

    it("assigns the next number to a second pair and frees it on undo", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        expect(screen.getAllByTestId("matching-pair-badge-1")).toHaveLength(2);
        expect(screen.getAllByTestId("matching-pair-badge-2")).toHaveLength(2);
        // Undo the first pair: its slot (1) is released, so a fresh
        // pair reuses it rather than climbing to 3.
        fireEvent.click(screen.getByTestId("matching-left-0"));
        expect(screen.queryAllByTestId("matching-pair-badge-1")).toHaveLength(
            0,
        );
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        expect(screen.getAllByTestId("matching-pair-badge-1")).toHaveLength(2);
    });
});

describe("MatchingExercise: bidirectional selection (#507)", () => {
    it("forms a pair when started from the B (right) column, then A", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={onComplete} />,
        );
        // Tap the right tile FIRST, then its matching left tile.
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-0"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /1\s*\/\s*3/,
        );
        // Finish the remaining pairs B -> A too, then submit.
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ correct: 3, total: 3 }),
        );
    });

    it("marks a B tile as selected (aria-pressed) when tapped first, and toggles off", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        const rightTile = screen.getByTestId("matching-right-0");
        expect(rightTile).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(rightTile);
        expect(rightTile).toHaveAttribute("aria-pressed", "true");
        // Tapping the same B tile again clears the selection.
        fireEvent.click(rightTile);
        expect(rightTile).toHaveAttribute("aria-pressed", "false");
    });

    it("undoes a pair regardless of the side that started it", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        // Pair B -> A, then undo by tapping the right tile.
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /1\s*\/\s*3/,
        );
        fireEvent.click(screen.getByTestId("matching-right-1"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /0\s*\/\s*3/,
        );
    });

    it("accepts duplicate B values when paired B -> A (#507 + #481)", () => {
        const onComplete = vi.fn();
        // libro + coche both take "el"; the two "el" right tiles are
        // interchangeable, and starting from the B side must still score
        // by VALUE, not index.
        const dupExercise: ContentLessonExercise = {
            id: "ex-dup-bidir",
            type: "matching",
            prompt: "Match each noun with its article.",
            card_ids: [],
            pairs: [
                { left: "libro", right: "el" },
                { left: "coche", right: "el" },
                { left: "casa", right: "la" },
            ],
            distractors: [],
        };
        render(
            <MatchingExercise exercise={dupExercise} onComplete={onComplete} />,
        );
        // Start from the "el" tiles (B side), cross-match to the nouns.
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ correct: 3, total: 3 }),
        );
    });
});

describe("MatchingExercise: animated pair resolution (#824)", () => {
    afterEach(() => {
        localStorage.clear();
    });

    function solveAll() {
        for (let i = 0; i < 3; i++) {
            fireEvent.click(screen.getByTestId(`matching-left-${i}`));
            fireEvent.click(screen.getByTestId(`matching-right-${i}`));
        }
    }

    it("hides the Auflösen button until the answer is checked", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(
            screen.queryByTestId("matching-resolve"),
        ).not.toBeInTheDocument();
        solveAll();
        // Still hidden before pressing Check.
        expect(
            screen.queryByTestId("matching-resolve"),
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(screen.getByTestId("matching-resolve")).toBeInTheDocument();
    });

    it("reveals the resolution view on click and hides the columns", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        solveAll();
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(screen.queryByTestId("matching-resolution")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("matching-resolve"));
        const resolution = screen.getByTestId("matching-resolution");
        // Default effect is "slide".
        expect(resolution).toHaveAttribute("data-effect", "slide");
        // The interactive columns are gone; the resolve button too.
        expect(screen.queryByTestId("matching-left")).not.toBeInTheDocument();
        expect(screen.queryByTestId("matching-resolve")).not.toBeInTheDocument();
    });

    it("uses the configured effect from localStorage", () => {
        localStorage.setItem(
            "adaptive-learner.matching.resolve_effect",
            "stack",
        );
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        solveAll();
        fireEvent.click(screen.getByTestId("matching-submit"));
        fireEvent.click(screen.getByTestId("matching-resolve"));
        expect(screen.getByTestId("matching-resolution")).toHaveAttribute(
            "data-effect",
            "stack",
        );
        // Stack shows one paired row per pair, in authored order.
        expect(screen.getByTestId("matching-resolved-row-0")).toHaveTextContent(
            "Bonjour",
        );
    });

    it("announces the original correct count after resolving", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        // 0→1 (wrong), 1→0 (wrong), 2→2 (correct): 1/3 correct.
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        fireEvent.click(screen.getByTestId("matching-resolve"));
        const status = screen.getByTestId("matching-resolve-status");
        expect(status).toHaveTextContent("1");
        expect(status).toHaveTextContent("3");
    });

    it("'Try again' clears the resolved view back to the columns", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        solveAll();
        fireEvent.click(screen.getByTestId("matching-submit"));
        fireEvent.click(screen.getByTestId("matching-resolve"));
        expect(screen.getByTestId("matching-resolution")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("matching-retry"));
        expect(
            screen.queryByTestId("matching-resolution"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("matching-left")).toBeInTheDocument();
    });

    it("skips the animation under prefers-reduced-motion", () => {
        const mql = {
            matches: true,
            media: "(prefers-reduced-motion: reduce)",
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            onchange: null,
            dispatchEvent: vi.fn(),
        } as unknown as MediaQueryList;
        const spy = vi
            .spyOn(window, "matchMedia")
            .mockImplementation(() => mql);
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        solveAll();
        fireEvent.click(screen.getByTestId("matching-submit"));
        fireEvent.click(screen.getByTestId("matching-resolve"));
        // The resolution shows immediately with no animation utility.
        const tile = screen.getByTestId("matching-resolved-b-0");
        expect(tile.className).not.toContain("animate-[matching-resolve");
        spy.mockRestore();
    });
});

describe("MatchingExercise: equal-height tiles (#822)", () => {
    // Regression pin (#822): the two column lists must stretch to equal
    // height so left/right tiles line up even when terms are short and
    // definitions long. flex-1 fills the (stretched) column div, and
    // [grid-auto-rows:1fr] then distributes the rows equally across both
    // grids; without flex-1 each list only matched its own content height.
    it("stretches both columns with flex-1 + equal auto rows", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        for (const testId of ["matching-left", "matching-right"]) {
            const list = screen.getByTestId(testId);
            const classes = list.className.split(/\s+/);
            expect(classes).toContain("flex-1");
            expect(classes).toContain("[grid-auto-rows:1fr]");
        }
    });
});
