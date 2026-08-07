/**
 * Tests for the lesson-end correction block
 * (Phase 52F / v1.35.0 / P-128, F-113; reworked #2496).
 *
 * Pins the self-hiding contract (perfect score / no errors / no
 * cloze-generation possible AND no replay → nothing rendered), the
 * #2496 collapse-by-default (no cloze mounts until the user expands, so
 * the mobile keyboard no longer pops on the summary), the folded-in
 * full-replay CTA, the skip path, and the recordBulk plumbing on
 * successful cloze completion.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import CorrectionBlock from "./CorrectionBlock";
import type {
    ContentLesson,
    ElementError,
    LessonProgress,
} from "../../../storage/types";

const listMock = vi.fn();
const recordBulkMock = vi.fn();

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            list: listMock,
            recordBulk: recordBulkMock,
            reviewQueue: vi.fn(),
        },
    }),
}));

beforeEach(() => {
    listMock.mockReset();
    recordBulkMock.mockReset();
});

function _error(overrides: Partial<ElementError> = {}): ElementError {
    return {
        id: "err-1",
        user_id: "user-1",
        set_id: "fr-a1",
        lesson_id: "03-articles.json",
        exercise_id: "ex-1",
        element_key: "un",
        element_type: "vocabulary",
        user_answer: "le",
        correct_answer: "un",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-05-27T12:00:00Z",
        last_attempt_at: "2026-05-27T12:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-05-27T12:00:00Z",
        updated_at: "2026-05-27T12:00:00Z",
        ...overrides,
    };
}

function _lesson(): ContentLesson {
    return {
        id: "03-articles",
        title: "Articles",
        description: null,
        estimated_minutes: 10,
        cards: [
            {
                id: "art-un",
                front: "un chat",
                back: "a cat",
                tags: ["article"],
                token_roles: [{token: "un", role: "article"}],
            },
        ],
        steps: [
            {
                id: "step-1",
                type: "exercise",
                exercise: {
                    id: "ex-1",
                    type: "free_text",
                    prompt: "How do you say 'a cat'?",
                    card_ids: ["art-un"],
                    accept: ["un chat"],
                    distractors: ["le chat", "la chat"],
                },
            },
        ],
    };
}

function _progress(
    overrides: Partial<LessonProgress> = {},
): LessonProgress {
    return {
        id: "lp-1",
        user_id: "user-1",
        source: "github://default",
        set_id: "fr-a1",
        lesson_filename: "03-articles.json",
        status: "in_progress",
        step_results: {
            "step-1": {
                correct: 0,
                total: 1,
                attempts: 1,
                completed_at: "2026-05-27T12:00:00Z",
            },
        },
        score_correct: 0,
        score_total: 1,
        time_spent_seconds: 60,
        started_at: "2026-05-27T11:59:00Z",
        updated_at: "2026-05-27T12:00:00Z",
        completed_at: null,
        paused_at: null,
        abandoned_at: null,
        ...overrides,
    };
}

describe("CorrectionBlock: self-hiding contract", () => {
    it("renders nothing when the lesson was a perfect score", async () => {
        const progress = _progress({
            step_results: {
                "step-1": {
                    correct: 1,
                    total: 1,
                    attempts: 1,
                    completed_at: "2026-05-27T12:00:00Z",
                },
            },
        });
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={progress}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />,
        );
        // listMock should not even be called when there are no
        // wrong attempts — the IO is skipped.
        expect(listMock).not.toHaveBeenCalled();
        expect(
            screen.queryByTestId("lesson-correction-block"),
        ).not.toBeInTheDocument();
    });

    it("renders nothing when the user id is empty (anonymous run)", async () => {
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId=""
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />,
        );
        expect(listMock).not.toHaveBeenCalled();
        expect(
            screen.queryByTestId("lesson-correction-block"),
        ).not.toBeInTheDocument();
    });

    it("renders nothing when elementErrors.list returns empty", async () => {
        listMock.mockResolvedValue([]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />,
        );
        await waitFor(() => expect(listMock).toHaveBeenCalled());
        expect(
            screen.queryByTestId("lesson-correction-block"),
        ).not.toBeInTheDocument();
    });

    it("renders nothing when every error fails cloze generation", async () => {
        // Error references an exercise_id that does NOT exist in the
        // lesson — generator can't find source exercise → returns null.
        listMock.mockResolvedValue([
            _error({exercise_id: "ex-ghost"}),
        ]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />,
        );
        await waitFor(() => expect(listMock).toHaveBeenCalled());
        expect(
            screen.queryByTestId("lesson-correction-block"),
        ).not.toBeInTheDocument();
    });

    it("filters out mastered errors", async () => {
        listMock.mockResolvedValue([
            _error({mastered: true, mastered_at: "2026-05-27T12:00:00Z"}),
        ]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />,
        );
        await waitFor(() => expect(listMock).toHaveBeenCalled());
        expect(
            screen.queryByTestId("lesson-correction-block"),
        ).not.toBeInTheDocument();
    });

    it("filters out errors for other lessons in the same set", async () => {
        listMock.mockResolvedValue([
            _error({lesson_id: "04-other.json"}),
        ]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />,
        );
        await waitFor(() => expect(listMock).toHaveBeenCalled());
        expect(
            screen.queryByTestId("lesson-correction-block"),
        ).not.toBeInTheDocument();
    });
});

describe("CorrectionBlock: render + skip + record", () => {
    it("collapsed by default; expands to the first cloze (#2496)", async () => {
        listMock.mockResolvedValue([
            _error({
                exercise_id: "ex-1",
                correct_answer: "un",
                element_key: "un",
                user_answer: "le",
            }),
        ]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />,
        );
        const block = await screen.findByTestId("lesson-correction-block");
        // #2496 — collapsed by default: no cloze is mounted, so nothing can
        // grab focus and pop the mobile keyboard on the summary.
        expect(block).toHaveAttribute("data-expanded", "false");
        expect(
            screen.queryByTestId("cloze-exercise"),
        ).not.toBeInTheDocument();
        // Expanding is the explicit opt-in: only THEN does the cloze mount.
        fireEvent.click(
            screen.getByTestId("lesson-correction-block-expand"),
        );
        expect(screen.getByTestId("cloze-exercise")).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-correction-block"),
        ).toHaveAttribute("data-cloze-total", "1");
    });

    it("skip triggers onSkip + transitions to complete-with-0", async () => {
        const onSkip = vi.fn();
        listMock.mockResolvedValue([
            _error({
                exercise_id: "ex-1",
                correct_answer: "un",
                element_key: "un",
            }),
        ]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={onSkip}
            />,
        );
        // #2496 — expand first: the skip control lives in the drill view.
        fireEvent.click(
            await screen.findByTestId("lesson-correction-block-expand"),
        );
        fireEvent.click(
            screen.getByTestId("lesson-correction-block-skip"),
        );
        expect(onSkip).toHaveBeenCalledTimes(1);
        // Block transitions to its "complete" state on skip.
        expect(
            screen.getByTestId("lesson-correction-block"),
        ).toHaveAttribute("data-status", "complete");
    });

    it("completing a cloze calls recordBulk with the attempt + advances", async () => {
        recordBulkMock.mockResolvedValue([]);
        listMock.mockResolvedValue([
            _error({
                exercise_id: "ex-1",
                correct_answer: "un",
                element_key: "un",
            }),
        ]);
        const onComplete = vi.fn();
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={onComplete}
                onSkip={vi.fn()}
            />,
        );
        // #2496 — expand to mount the cloze before interacting with it.
        fireEvent.click(
            await screen.findByTestId("lesson-correction-block-expand"),
        );
        await waitFor(() =>
            expect(
                screen.queryByTestId("cloze-input-0"),
            ).toBeInTheDocument(),
        );
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "un"},
        });
        // #187 — the cloze now runs controlled; the parent owns the
        // "Check answers" button (enabled once all blanks are filled).
        await waitFor(() =>
            expect(
                screen.getByTestId("lesson-correction-block-check"),
            ).toBeEnabled(),
        );
        fireEvent.click(
            screen.getByTestId("lesson-correction-block-check"),
        );
        await waitFor(() =>
            expect(recordBulkMock).toHaveBeenCalled(),
        );
        expect(recordBulkMock).toHaveBeenCalledWith(
            "user-1",
            expect.arrayContaining([
                expect.objectContaining({
                    exercise_id: expect.stringContaining(
                        "gen-cloze-ex-1",
                    ),
                    correct: true,
                }),
            ]),
        );
        // Only one cloze → onComplete fires with improved=1.
        await waitFor(() =>
            expect(onComplete).toHaveBeenCalledWith(1),
        );
        // Block now in complete state.
        expect(
            screen.getByTestId("lesson-correction-block"),
        ).toHaveAttribute("data-status", "complete");
        expect(
            screen.getByTestId("lesson-correction-improvement"),
        ).toHaveTextContent(/1 element/);
    });

    it("Enter checks the answered cloze (correction-round shortcut, #187)", async () => {
        recordBulkMock.mockResolvedValue([]);
        listMock.mockResolvedValue([
            _error({
                exercise_id: "ex-1",
                correct_answer: "un",
                element_key: "un",
            }),
        ]);
        const onComplete = vi.fn();
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={onComplete}
                onSkip={vi.fn()}
            />,
        );
        // #2496 — expand to mount the cloze before interacting with it.
        fireEvent.click(
            await screen.findByTestId("lesson-correction-block-expand"),
        );
        await waitFor(() =>
            expect(
                screen.queryByTestId("cloze-input-0"),
            ).toBeInTheDocument(),
        );
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "un"},
        });
        // Once answerable, Enter must do what the Check button does.
        await waitFor(() =>
            expect(
                screen.getByTestId("lesson-correction-block-check"),
            ).toBeEnabled(),
        );
        fireEvent.keyDown(window, {key: "Enter"});
        await waitFor(() =>
            expect(recordBulkMock).toHaveBeenCalled(),
        );
        await waitFor(() =>
            expect(onComplete).toHaveBeenCalledWith(1),
        );
    });

    it("Enter is inert until the cloze is answerable (no double-lock)", async () => {
        recordBulkMock.mockResolvedValue([]);
        listMock.mockResolvedValue([
            _error({
                exercise_id: "ex-1",
                correct_answer: "un",
                element_key: "un",
            }),
        ]);
        const onComplete = vi.fn();
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={onComplete}
                onSkip={vi.fn()}
            />,
        );
        // #2496 — expand to mount the cloze before interacting with it.
        fireEvent.click(
            await screen.findByTestId("lesson-correction-block-expand"),
        );
        await waitFor(() =>
            expect(
                screen.queryByTestId("cloze-input-0"),
            ).toBeInTheDocument(),
        );
        // Enter on an EMPTY cloze must not check (Check button disabled).
        // Critically it must not arm the double-check lock, or the later
        // real Enter would be swallowed.
        fireEvent.keyDown(window, {key: "Enter"});
        expect(recordBulkMock).not.toHaveBeenCalled();
        // Now fill + Enter — it must still check.
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "un"},
        });
        await waitFor(() =>
            expect(
                screen.getByTestId("lesson-correction-block-check"),
            ).toBeEnabled(),
        );
        fireEvent.keyDown(window, {key: "Enter"});
        await waitFor(() =>
            expect(recordBulkMock).toHaveBeenCalled(),
        );
    });

    it("Enter is inert while the section is collapsed (#2496)", async () => {
        listMock.mockResolvedValue([
            _error({
                exercise_id: "ex-1",
                correct_answer: "un",
                element_key: "un",
            }),
        ]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
            />,
        );
        // Collapsed: no cloze mounted, so Enter must not reach a checker.
        await screen.findByTestId("lesson-correction-block-expand");
        fireEvent.keyDown(window, {key: "Enter"});
        expect(recordBulkMock).not.toHaveBeenCalled();
        expect(screen.queryByTestId("cloze-exercise")).not.toBeInTheDocument();
    });
});

describe("CorrectionBlock: folded-in full-replay CTA (#2496)", () => {
    const REPLAY = {
        exercises: [],
        cards: [],
        lessonTitle: "Articles",
    };

    it("renders a collapsed mistakes section with a replay CTA when no cloze generates", async () => {
        // A ghost exercise_id → no cloze can be generated, but there is still
        // a replayable failed set: the section stays, offering the full replay.
        listMock.mockResolvedValue([_error({exercise_id: "ex-ghost"})]);
        render(
            <MemoryRouter>
                <CorrectionBlock
                    lesson={_lesson()}
                    progress={_progress()}
                    userId="user-1"
                    setId="fr-a1"
                    lessonFilename="03-articles.json"
                    onComplete={vi.fn()}
                    onSkip={vi.fn()}
                    replayHref="/error-replay/bundled:x/fr-a1/03-articles.json"
                    replayState={REPLAY}
                    errorCount={2}
                />
            </MemoryRouter>,
        );
        const block = await screen.findByTestId("lesson-correction-block");
        expect(block).toHaveAttribute("data-expanded", "false");
        // Expand → the full-replay link, no cloze.
        fireEvent.click(
            screen.getByTestId("lesson-correction-block-expand"),
        );
        expect(
            screen.queryByTestId("cloze-exercise"),
        ).not.toBeInTheDocument();
        const replay = screen.getByTestId("lesson-correction-replay");
        expect(replay).toHaveAttribute(
            "href",
            "/error-replay/bundled:x/fr-a1/03-articles.json",
        );
    });

    it("shows the corrected-progress note when some errors are already fixed", async () => {
        listMock.mockResolvedValue([_error({exercise_id: "ex-ghost"})]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
                replayHref="/error-replay/bundled:x/fr-a1/03-articles.json"
                replayState={REPLAY}
                errorCount={2}
                correctedCount={3}
            />,
        );
        const corrected = await screen.findByTestId(
            "lesson-correction-corrected",
        );
        // "{corrected} of {total}" → 3 of 5.
        expect(corrected.textContent).toMatch(/3/);
        expect(corrected.textContent).toMatch(/5/);
    });

    it("shows an all-corrected success note when every error is fixed", async () => {
        listMock.mockResolvedValue([]);
        render(
            <CorrectionBlock
                lesson={_lesson()}
                progress={_progress()}
                userId="user-1"
                setId="fr-a1"
                lessonFilename="03-articles.json"
                onComplete={vi.fn()}
                onSkip={vi.fn()}
                replayHref={null}
                errorCount={0}
                correctedCount={4}
                allCorrected
            />,
        );
        const block = await screen.findByTestId("lesson-correction-block");
        expect(block).toHaveAttribute("data-status", "complete");
        expect(
            screen.getByTestId("lesson-correction-improvement"),
        ).toBeInTheDocument();
        // No drill, no expand button — nothing left to do.
        expect(
            screen.queryByTestId("lesson-correction-block-expand"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("lesson-correction-replay"),
        ).not.toBeInTheDocument();
    });
});
