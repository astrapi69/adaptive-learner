/**
 * Tests for the ext:al-categorization renderer (#1579) - the first adopted
 * extension exercise type (schema 1.7 extension tier).
 *
 * Pins the tap-item-then-tap-bucket assignment flow, the all-assigned
 * checkability gate, per-item scoring with the SRS fan-out + raw_answer,
 * the per-chip resolution verdicts, retry, and the reviewed (locked)
 * reconstruction.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import CategorizationExercise from "./CategorizationExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-categ-01",
    type: "ext:al-categorization",
    prompt: "Ordne jedes Signal der richtigen Kategorie zu.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        categories: [
            {name: "Sichtzeichen", items: ["flache Hand", "Zeigefinger hoch"]},
            {name: "Hoerzeichen", items: ["Sitz", "Platz"]},
        ],
    },
} as unknown as ContentLessonExercise;

const tap = (name: string) =>
    fireEvent.click(screen.getByRole("button", {name}));

/** Assign one item: tap the item chip, then the bucket's assign target. */
const assign = (item: string, bucket: string) => {
    tap(item);
    fireEvent.click(screen.getByTestId(`categorization-bucket-assign-${bucket}`));
};

const assignAllCorrectly = () => {
    assign("flache Hand", "Sichtzeichen");
    assign("Zeigefinger hoch", "Sichtzeichen");
    assign("Sitz", "Hoerzeichen");
    assign("Platz", "Hoerzeichen");
};

describe("CategorizationExercise: render", () => {
    it("renders prompt, both buckets, and the full item pool", () => {
        render(<CategorizationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("categorization-prompt")).toHaveTextContent(
            "Ordne jedes Signal",
        );
        expect(
            screen.getByTestId("categorization-bucket-assign-Sichtzeichen"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("categorization-bucket-assign-Hoerzeichen"),
        ).toBeInTheDocument();
        const pool = screen.getByTestId("categorization-pool");
        for (const item of ["flache Hand", "Zeigefinger hoch", "Sitz", "Platz"]) {
            expect(within(pool).getByRole("button", {name: item})).toBeInTheDocument();
        }
    });

    it("renders the empty state for a malformed payload", () => {
        const broken = {
            ...EXERCISE,
            ext_payload: {categories: "nope"},
        } as unknown as ContentLessonExercise;
        render(<CategorizationExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("categorization-empty")).toBeInTheDocument();
    });
});

describe("CategorizationExercise: assignment flow", () => {
    it("tap item + tap bucket moves the chip into the bucket", () => {
        render(<CategorizationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        assign("Sitz", "Hoerzeichen");
        const bucket = screen.getByTestId("categorization-bucket-Hoerzeichen");
        expect(within(bucket).getByRole("button", {name: "Sitz"})).toBeInTheDocument();
        expect(
            within(screen.getByTestId("categorization-pool")).queryByRole("button", {
                name: "Sitz",
            }),
        ).not.toBeInTheDocument();
    });

    it("tapping an assigned chip returns it to the pool", () => {
        render(<CategorizationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        assign("Sitz", "Hoerzeichen");
        const bucket = screen.getByTestId("categorization-bucket-Hoerzeichen");
        fireEvent.click(within(bucket).getByRole("button", {name: "Sitz"}));
        expect(
            within(screen.getByTestId("categorization-pool")).getByRole("button", {
                name: "Sitz",
            }),
        ).toBeInTheDocument();
    });

    it("the check button stays disabled until every item is assigned", () => {
        render(<CategorizationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("categorization-submit")).toBeDisabled();
        assign("flache Hand", "Sichtzeichen");
        expect(screen.getByTestId("categorization-submit")).toBeDisabled();
        assign("Zeigefinger hoch", "Sichtzeichen");
        assign("Sitz", "Hoerzeichen");
        assign("Platz", "Hoerzeichen");
        expect(screen.getByTestId("categorization-submit")).toBeEnabled();
    });
});

describe("CategorizationExercise: submit lifecycle", () => {
    it("scores per item and reports the SRS fan-out + raw_answer", () => {
        const onComplete = vi.fn();
        render(
            <CategorizationExercise
                exercise={EXERCISE}
                setId="set-1"
                lessonId="lesson-1"
                onComplete={onComplete}
            />,
        );
        assignAllCorrectly();
        fireEvent.click(screen.getByTestId("categorization-submit"));
        expect(onComplete).toHaveBeenCalledTimes(1);
        const scored = onComplete.mock.calls[0][0];
        expect(scored.correct).toBe(4);
        expect(scored.total).toBe(4);
        expect(scored.attempts).toHaveLength(4);
        expect(scored.attempts[0]).toMatchObject({
            set_id: "set-1",
            lesson_id: "lesson-1",
            exercise_id: "ex-categ-01",
        });
        expect(scored.raw_answer.kind).toBe("al_categorization");
        expect(scored.raw_answer.assignments).toHaveLength(4);
        expect(screen.getByTestId("categorization-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("a misplaced item scores 3/4, shows the wrong verdict and the authored bucket", () => {
        const onComplete = vi.fn();
        render(<CategorizationExercise exercise={EXERCISE} onComplete={onComplete} />);
        assign("flache Hand", "Sichtzeichen");
        assign("Zeigefinger hoch", "Sichtzeichen");
        assign("Sitz", "Sichtzeichen"); // misplaced
        assign("Platz", "Hoerzeichen");
        fireEvent.click(screen.getByTestId("categorization-submit"));
        const scored = onComplete.mock.calls[0][0];
        expect(scored.correct).toBe(3);
        expect(scored.total).toBe(4);
        expect(screen.getByTestId("categorization-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        const misplacedChip = screen.getByTestId("categorization-chip-Sitz");
        expect(misplacedChip).toHaveAttribute("data-verdict", "wrong");
        expect(misplacedChip).toHaveTextContent("Hoerzeichen");
        expect(screen.getByTestId("categorization-chip-Platz")).toHaveAttribute(
            "data-verdict",
            "correct",
        );
    });

    it("retry clears the assignments so the user can re-answer", () => {
        render(<CategorizationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        assignAllCorrectly();
        fireEvent.click(screen.getByTestId("categorization-submit"));
        fireEvent.click(screen.getByTestId("categorization-retry"));
        const pool = screen.getByTestId("categorization-pool");
        for (const item of ["flache Hand", "Zeigefinger hoch", "Sitz", "Platz"]) {
            expect(within(pool).getByRole("button", {name: item})).toBeInTheDocument();
        }
        expect(screen.getByTestId("categorization-submit")).toBeDisabled();
    });
});

describe("CategorizationExercise: reviewed (locked) reconstruction", () => {
    it("restores the persisted assignment as a checked, locked result", () => {
        render(
            <CategorizationExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{
                    kind: "al_categorization",
                    assignments: [
                        ["flache Hand", "Sichtzeichen"],
                        ["Zeigefinger hoch", "Sichtzeichen"],
                        ["Sitz", "Sichtzeichen"],
                        ["Platz", "Hoerzeichen"],
                    ],
                }}
            />,
        );
        expect(screen.getByTestId("categorization-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        expect(screen.getByTestId("categorization-chip-Sitz")).toHaveAttribute(
            "data-verdict",
            "wrong",
        );
        expect(
            screen.queryByTestId("categorization-submit"),
        ).not.toBeInTheDocument();
    });
});
