import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, fireEvent, waitFor, cleanup} from "@testing-library/react";
import {MemoryRouter} from "react-router";

import BookTextStep, {type BookFields} from "./BookTextStep";
import type {ResolvedAiProvider} from "../../../lib/ai/providers/resolve-provider";
import type {TheoryGenerationResult} from "../../../lib/ai/generation/generate-theory-from-text";
import type {ExerciseGenerationResult} from "../../../lib/ai/generation/generate-exercises";

const t = (_k: string, fallback?: string) => fallback ?? _k;

const EMPTY_BOOK: BookFields = {title: "", author: "", url: "", asin: ""};

const CONFIG: ResolvedAiProvider = {
    provider: "anthropic",
    model: "claude",
    apiKey: "sk-test",
};

/** A theory-gen seam returning one rephrased step. */
const theoryOk = vi.fn(
    async (): Promise<TheoryGenerationResult> => ({
        steps: [
            {id: "theory-1", title: "Konditionierung", body: "In eigenen Worten."},
        ],
        errors: [],
    }),
);

/** An exercise-gen seam returning one free_text card (maps to 1 exercise). */
const exercisesOk = vi.fn(
    async (): Promise<ExerciseGenerationResult> => ({
        cards: [
            {
                type: "free_text",
                question: "Was ist ein bedingter Reiz?",
                accepts: ["ein gelernter Reiz"],
                distractors: [],
            },
        ],
        skipped: 0,
        errors: [],
        rejected: [],
        warnings: [],
    }),
);

function setup(overrides: Partial<React.ComponentProps<typeof BookTextStep>> = {}) {
    const onGenerated = vi.fn();
    const onBatchGenerated = vi.fn();
    const props: React.ComponentProps<typeof BookTextStep> = {
        bookText: "Ein neutraler Reiz wird zum bedingten Reiz.",
        onBookTextChange: vi.fn(),
        book: EMPTY_BOOK,
        onBookChange: vi.fn(),
        resolveProvider: vi.fn(async () => CONFIG),
        onGenerated,
        onBatchGenerated,
        t,
        generateTheory: theoryOk,
        generate: exercisesOk,
        ...overrides,
    };
    render(
        <MemoryRouter>
            <BookTextStep {...props} />
        </MemoryRouter>,
    );
    return {onGenerated, onBatchGenerated, props};
}

/** A two-chapter markdown file for the real upload parser. */
function markdownFile(): File {
    const md = "# Kapitel 1\nInhalt eins.\n\n# Kapitel 2\nInhalt zwei.\n";
    return new File([md], "buch.md", {type: "text/markdown"});
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("BookTextStep", () => {
    it("renders the paste field and the book-metadata inputs", () => {
        setup();
        expect(screen.getByTestId("book-text-input")).toBeTruthy();
        expect(screen.getByTestId("book-title")).toBeTruthy();
        expect(screen.getByTestId("book-author")).toBeTruthy();
        expect(screen.getByTestId("book-generate")).toBeTruthy();
    });

    it("shows the non-blocking text-rights hint (#1743)", () => {
        setup();
        const hint = screen.getByTestId("book-rights-hint");
        expect(hint.textContent).toMatch(/rights|personal use/i);
    });

    it("generates theory + exercises and reports them upward", async () => {
        const {onGenerated} = setup();
        fireEvent.click(screen.getByTestId("book-generate"));
        await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));
        const [steps, exercises] = onGenerated.mock.calls[0];
        expect(steps).toHaveLength(1);
        expect(steps[0].id).toBe("theory-1");
        expect(exercises).toHaveLength(1);
        expect(exercises[0].type).toBe("free_text");
        // The rephrase seam was called with the pasted book text.
        expect(theoryOk).toHaveBeenCalledWith(
            "Ein neutraler Reiz wird zum bedingten Reiz.",
            expect.anything(),
            expect.anything(),
        );
    });

    it("shows the no-key notice and does not generate when no key is set", async () => {
        const {onGenerated} = setup({resolveProvider: vi.fn(async () => null)});
        fireEvent.click(screen.getByTestId("book-generate"));
        await waitFor(() =>
            expect(screen.getByTestId("book-no-key")).toBeTruthy(),
        );
        expect(onGenerated).not.toHaveBeenCalled();
    });

    it("does not call the provider when the paste field is blank", async () => {
        const resolveProvider = vi.fn(async () => CONFIG);
        const {onGenerated} = setup({bookText: "   ", resolveProvider});
        fireEvent.click(screen.getByTestId("book-generate"));
        await waitFor(() => expect(onGenerated).not.toHaveBeenCalled());
        expect(resolveProvider).not.toHaveBeenCalled();
    });

    it("surfaces a provider error without crashing", async () => {
        const failing = vi.fn(async () => {
            throw new Error("HTTP 401: invalid key");
        });
        const {onGenerated} = setup({generateTheory: failing});
        fireEvent.click(screen.getByTestId("book-generate"));
        // No throw bubbles out; the callback simply never fires.
        await waitFor(() => expect(failing).toHaveBeenCalled());
        expect(onGenerated).not.toHaveBeenCalled();
        // The component is still mounted (no crash).
        expect(screen.getByTestId("book-generate")).toBeTruthy();
    });

    it("edits book metadata through onBookChange", () => {
        const onBookChange = vi.fn();
        setup({onBookChange});
        fireEvent.change(screen.getByTestId("book-title"), {
            target: {value: "KI fuer Einsteiger"},
        });
        expect(onBookChange).toHaveBeenCalledWith({title: "KI fuer Einsteiger"});
    });

    it("batch-generates one lesson per selected section (#1949)", async () => {
        const {onBatchGenerated} = setup();
        // Upload a two-chapter markdown file through the real parser.
        fireEvent.change(screen.getByTestId("book-upload-input"), {
            target: {files: [markdownFile()]},
        });
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        const button = screen.getByTestId("book-upload-apply");
        expect(button.textContent).toContain("Generate 2");
        fireEvent.click(button);
        await waitFor(() =>
            expect(onBatchGenerated).toHaveBeenCalledTimes(1),
        );
        const lessons = onBatchGenerated.mock.calls[0][0];
        expect(lessons).toHaveLength(2);
        expect(lessons.map((l: {title: string}) => l.title)).toEqual([
            "Kapitel 1",
            "Kapitel 2",
        ]);
        // Each section produced theory + at least one exercise.
        expect(lessons[0].theorySteps.length).toBeGreaterThan(0);
        expect(lessons[0].exercises.length).toBeGreaterThan(0);
        // A batch summary is shown.
        expect(screen.getByTestId("book-batch-summary").textContent).toContain(
            "2 of 2",
        );
    });

    it("does not batch-generate when no key is set (#1949)", async () => {
        const {onBatchGenerated} = setup({
            resolveProvider: vi.fn(async () => null),
        });
        fireEvent.change(screen.getByTestId("book-upload-input"), {
            target: {files: [markdownFile()]},
        });
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId("book-upload-apply"));
        await waitFor(() =>
            expect(screen.getByTestId("book-no-key")).toBeTruthy(),
        );
        expect(onBatchGenerated).not.toHaveBeenCalled();
    });
});

describe("BookTextStep — exercise-type selection (#2510)", () => {
    it("renders the type selector with the asset-bound types greyed out", () => {
        globalThis.localStorage?.clear();
        setup();
        expect(screen.getByTestId("assistant-type-selector")).toBeTruthy();
        const img = screen.getByTestId(
            "assistant-type-unavailable-image-description",
        ) as HTMLInputElement;
        expect(img.disabled).toBe(true);
    });

    it("places the type selector BEFORE the textbook textarea (#2522)", () => {
        globalThis.localStorage?.clear();
        setup();
        const selector = screen.getByTestId("assistant-type-selector");
        const textarea = screen.getByTestId("book-text-input");
        // The textarea must FOLLOW the selector in document order, so the user
        // decides the types before pasting the (large) chapter text.
        expect(
            selector.compareDocumentPosition(textarea) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("passes the selected types into generation", async () => {
        globalThis.localStorage?.clear();
        setup();
        fireEvent.click(screen.getByTestId("book-generate"));
        await waitFor(() => expect(exercisesOk).toHaveBeenCalled());
        const lastCall = exercisesOk.mock.calls.at(-1) as unknown[] | undefined;
        const opts = lastCall?.[2] as {types?: string[]} | undefined;
        expect(opts?.types).toEqual(
            expect.arrayContaining(["free_text", "cloze", "matching"]),
        );
        // A greyed, asset-bound type is never in the selection.
        expect(opts?.types).not.toContain("picture_choice");
        expect(opts?.types).not.toContain("ext:al-image-description");
    });

    it("names selected types that produced nothing (Part 4)", async () => {
        globalThis.localStorage?.clear();
        setup();
        fireEvent.click(screen.getByTestId("book-generate"));
        await waitFor(() =>
            expect(screen.getByTestId("book-gen-missing")).toBeTruthy(),
        );
        // free_text WAS produced -> not listed; a selected-but-absent type is.
        expect(screen.queryByTestId("book-gen-missing-free_text")).toBeNull();
        expect(screen.getByTestId("book-gen-missing-matching")).toBeTruthy();
    });
});
