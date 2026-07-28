/**
 * Tests for the ext:al-image-description renderer (#2095, sixth adoption): the
 * learner sees an image, then types a free-text description.
 *
 * Pins that an embedded data URI renders directly (bypassing the asset layer),
 * that an ``assets/`` path is resolved via useAsset, that a remote URL is never
 * rendered (offline-first), that the typed answer is graded through the shared
 * free-text matcher (correct / near-miss / wrong), the canonical solution after
 * a wrong attempt, the reviewed (locked) reconstruction, and the a11y contract
 * (the alt text names the element without leaking the answer).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

// Stub the asset resolver: a non-null (source, setId, path) triple resolves to
// a fake blob URL; anything else is a miss. Its own resolution chain is covered
// by useAsset's own test.
vi.mock("../../../hooks/ui/useAsset", () => ({
    useAsset: (
        source: string | null,
        setId: string | null,
        path: string | null,
    ) => ({
        url: source && setId && path ? `blob:resolved-${path}` : null,
        loading: false,
    }),
}));

import ImageDescriptionExercise from "./ImageDescriptionExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const DATA_URI = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

function exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-imgdesc-01",
        type: "ext:al-image-description",
        prompt: "Describe what you see.",
        card_ids: [],
        distractors: [],
        ext_payload: payload,
        ...overrides,
    } as unknown as ContentLessonExercise;
}

const EMBEDDED = exercise({image: DATA_URI, accept: ["a cat", "cat"]});

const type = (value: string) =>
    fireEvent.change(screen.getByTestId("image-description-input"), {
        target: {value},
    });
const submit = () =>
    fireEvent.click(screen.getByTestId("image-description-submit"));

describe("ImageDescriptionExercise: render + image resolution", () => {
    it("renders the prompt, the input, and the embedded image directly", () => {
        render(<ImageDescriptionExercise exercise={EMBEDDED} onComplete={vi.fn()} />);
        expect(screen.getByTestId("image-description-prompt")).toHaveTextContent(
            "Describe what you see",
        );
        expect(screen.getByTestId("image-description-input")).toBeInTheDocument();
        const img = screen.getByTestId("image-description-image");
        expect(img).toHaveAttribute("src", DATA_URI);
    });

    it("resolves an assets/ path through useAsset", () => {
        render(
            <ImageDescriptionExercise
                exercise={exercise({image: "assets/img/cat.png", accept: ["a cat"]})}
                setId="set-1"
                source="own/repo"
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("image-description-image")).toHaveAttribute(
            "src",
            "blob:resolved-img/cat.png",
        );
    });

    it("never renders a remote URL image (offline-first)", () => {
        render(
            <ImageDescriptionExercise
                exercise={exercise({
                    image: "https://example.com/cat.png",
                    accept: ["a cat"],
                })}
                setId="set-1"
                source="own/repo"
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.queryByTestId("image-description-image"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("image-description-image-missing"),
        ).toBeInTheDocument();
    });

    it("renders the empty state for a malformed payload", () => {
        render(
            <ImageDescriptionExercise
                exercise={exercise({accept: ["x"]})}
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.getByTestId("image-description-empty"),
        ).toBeInTheDocument();
    });
});

describe("ImageDescriptionExercise: accessibility (honest)", () => {
    it("gives the image a non-empty alt that does NOT reveal the answer", () => {
        render(<ImageDescriptionExercise exercise={EMBEDDED} onComplete={vi.fn()} />);
        const alt = screen.getByTestId("image-description-image").getAttribute("alt");
        expect(alt).toBeTruthy();
        expect(alt).not.toContain("a cat");
        expect(alt).not.toContain("cat");
    });

    it("labels the free-text input", () => {
        render(<ImageDescriptionExercise exercise={EMBEDDED} onComplete={vi.fn()} />);
        expect(screen.getByTestId("image-description-input")).toHaveAttribute(
            "aria-label",
        );
    });
});

describe("ImageDescriptionExercise: grading (shared free-text matcher)", () => {
    it("marks an exact answer correct", () => {
        const onComplete = vi.fn();
        render(<ImageDescriptionExercise exercise={EMBEDDED} onComplete={onComplete} />);
        type("a cat");
        submit();
        expect(screen.getByTestId("image-description-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                correct: 1,
                total: 1,
                raw_answer: {kind: "al_image_description", input: "a cat"},
            }),
        );
    });

    it("accepts a single-typo answer (Levenshtein tolerance)", () => {
        render(<ImageDescriptionExercise exercise={EMBEDDED} onComplete={vi.fn()} />);
        type("caat"); // one insertion vs accepted "cat" -> distance 1
        submit();
        expect(screen.getByTestId("image-description-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("marks a far-off answer wrong and surfaces the canonical solution", () => {
        render(<ImageDescriptionExercise exercise={EMBEDDED} onComplete={vi.fn()} />);
        type("something else entirely");
        submit();
        expect(screen.getByTestId("image-description-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        expect(screen.getByTestId("image-description-solution")).toHaveTextContent(
            "a cat",
        );
    });

    it("cannot check an empty input", () => {
        render(<ImageDescriptionExercise exercise={EMBEDDED} onComplete={vi.fn()} />);
        expect(screen.getByTestId("image-description-submit")).toBeDisabled();
    });
});

describe("ImageDescriptionExercise: reviewed reconstruction", () => {
    it("locks to the reviewed input + verdict", () => {
        render(
            <ImageDescriptionExercise
                exercise={EMBEDDED}
                onComplete={vi.fn()}
                reviewed={{kind: "al_image_description", input: "a cat"}}
            />,
        );
        expect(screen.getByTestId("image-description-input")).toHaveValue("a cat");
        expect(screen.getByTestId("image-description-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });
});
