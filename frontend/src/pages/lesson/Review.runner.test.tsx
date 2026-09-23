/**
 * Review on the LessonRunner shell (EXP-052 slice 1, refs #3169).
 *
 * The four behaviours the shell adds to the review session, each as
 * reproduction + happy path + edge + boundary (tdd.md): the page renders
 * ``review-page`` FROM the shell; the Enter shortcut checks then
 * advances; the view re-anchors after a step change and after a device
 * rotation (#3126 / #1422, new for review); hint usage is cleared at run
 * start and only there (#3196); and an answered step re-entered through
 * "Previous" is locked (#1790), so no second ``recordStepAttempts`` for
 * the same element in one run.
 *
 * ``useReviewLesson`` is a stateful mock (the step index lives in React
 * state so Next / Previous move it); ``ExerciseDispatcher`` is a minimal
 * controlled exercise that reports the ``reviewed`` lock it receives.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {markHintUsed, wasHintUsed} from "../../lib/hints/hint-usage";
import {setLessonShortcutsEnabled} from "../../lib/lesson/prefs/lessonShortcutsPref";

const hoisted = vi.hoisted(() => {
    const step = (id: string) => ({
        id,
        type: "exercise" as const,
        title: null,
        review_lesson_id: "01-greetings.json",
        exercise: {
            id: id.replace("review-", "ex-"),
            type: "cloze" as const,
            prompt: "Fill in",
            card_ids: [],
            sentence: "___ beaucoup",
            blanks: ["merci"],
            distractors: [],
        },
    });
    return {
        submitSpy: vi.fn(),
        recordStepAttempts: vi.fn().mockResolvedValue(undefined),
        reloadSpy: vi.fn(),
        lessonRunnerSpy: vi.fn(),
        initialIndex: {value: 0},
        LESSON: {
            id: "review-fr-a1",
            title: "Review session",
            description: null,
            estimated_minutes: 1,
            cards: [],
            steps: [step("review-s0"), step("review-s1")],
        },
        QUEUE: [
            {element_key: "merci", error_count: 1},
            {element_key: "bonjour", error_count: 1},
            {element_key: "salut", error_count: 1},
        ],
    };
});

vi.mock("../../hooks/lesson/modes/useReviewLesson", async () => {
    const {useState} = await import("react");
    return {
        useReviewLesson: () => {
            const [idx, setIdx] = useState(hoisted.initialIndex.value);
            const total = hoisted.LESSON.steps.length;
            return {
                status: "ready",
                lesson: hoisted.LESSON,
                queue: hoisted.QUEUE,
                currentStepIndex: idx,
                dueCount: 3,
                error: null,
                goNext: () => setIdx((i) => Math.min(i + 1, total)),
                goPrev: () => setIdx((i) => Math.max(i - 1, 0)),
                goToStep: (n: number) => setIdx(n),
                recordStepAttempts: hoisted.recordStepAttempts,
                sessionScoreCorrect: 1,
                sessionScoreTotal: 2,
                remaining: 1,
                reload: () => {
                    hoisted.reloadSpy();
                    setIdx(0);
                },
            };
        },
    };
});

vi.mock("../../components/exercises/shell/ExerciseDispatcher", async (orig) => {
    const actual =
        await orig<typeof import("../../components/exercises/shell/ExerciseDispatcher")>();
    const {forwardRef, useImperativeHandle} = await import("react");
    type Props = {
        reviewed?: unknown;
        onInteraction?: (a: boolean) => void;
        onComplete: (r: {
            correct: number;
            total: number;
            attempts: unknown[];
            raw_answer: unknown;
        }) => Promise<void>;
    };
    const Mock = forwardRef<{submit: () => void}, Props>((props, ref) => {
        useImperativeHandle(ref, () => ({
            submit: () => {
                hoisted.submitSpy();
                void props.onComplete({
                    correct: 1,
                    total: 1,
                    attempts: [{element_key: "merci", correct: true}],
                    raw_answer: {kind: "cloze", inputs: ["merci"]},
                });
            },
        }));
        return (
            <div
                data-testid="mock-exercise"
                data-reviewed={props.reviewed ? "locked" : "open"}
            >
                <input
                    data-testid="mock-input"
                    onChange={() => props.onInteraction?.(true)}
                />
            </div>
        );
    });
    Mock.displayName = "MockExerciseDispatcher";
    return {...actual, ExerciseDispatcher: Mock};
});

vi.mock("../../components/lesson/runner/LessonRunner", async (orig) => {
    const actual =
        await orig<typeof import("../../components/lesson/runner/LessonRunner")>();
    const Spy = (props: Parameters<typeof actual.default>[0]) => {
        hoisted.lessonRunnerSpy(props);
        return actual.default(props);
    };
    return {...actual, default: Spy};
});

import ReviewPage from "./Review";
import {REVIEW_POLICY} from "../../components/lesson/runner/policies";

function mount() {
    return render(
        <MemoryRouter initialEntries={["/review/fr-a1"]}>
            <Routes>
                <Route path="/review/:setId" element={<ReviewPage />} />
                <Route path="/dashboard" element={<div data-testid="dashboard-stub" />} />
            </Routes>
        </MemoryRouter>,
    );
}

/** Answer the open step and check it (Check -> Next phase). */
async function answerAndCheck() {
    fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "merci"}});
    await waitFor(() => expect(screen.getByTestId("review-check")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("review-check"));
    await waitFor(() => expect(screen.getByTestId("review-next")).toBeInTheDocument());
}

let scrollSpy: ReturnType<typeof vi.fn>;
let orientationListeners: Array<() => void>;

beforeEach(() => {
    hoisted.submitSpy.mockClear();
    hoisted.recordStepAttempts.mockClear();
    hoisted.reloadSpy.mockClear();
    hoisted.lessonRunnerSpy.mockClear();
    hoisted.initialIndex.value = 0;
    setLessonShortcutsEnabled(true);
    scrollSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: scrollSpy,
    });
    orientationListeners = [];
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: (_type: string, cb: () => void) => {
            orientationListeners.push(cb);
        },
        removeEventListener: (_type: string, cb: () => void) => {
            orientationListeners = orientationListeners.filter((l) => l !== cb);
        },
    }));
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("Review renders through the LessonRunner shell (#3169)", () => {
    it("renders data-testid=review-page FROM the shell with the review policy", () => {
        mount();
        expect(screen.getByTestId("review-page")).toBeInTheDocument();
        expect(hoisted.lessonRunnerSpy).toHaveBeenCalled();
        expect(hoisted.lessonRunnerSpy.mock.calls[0][0].policy).toBe(REVIEW_POLICY);
    });

    it("keeps the review chrome testids: back button, subtitle, progress bar, step, footer", () => {
        mount();
        for (const id of [
            "review-back-btn",
            "review-subtitle",
            "review-progress-bar",
            "review-step-review-s0",
            "review-prev",
            "review-check",
        ]) {
            expect(screen.getByTestId(id)).toBeInTheDocument();
        }
    });
});

describe("Enter shortcut on the review runner", () => {
    it("reproduction + happy path: Enter checks the answered step, a second Enter advances", async () => {
        mount();
        fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "merci"}});
        fireEvent.keyDown(window, {key: "Enter"});
        expect(hoisted.submitSpy).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByTestId("review-next")).toBeInTheDocument());
        fireEvent.keyDown(window, {key: "Enter"});
        await waitFor(() =>
            expect(screen.getByTestId("review-step-review-s1")).toBeInTheDocument(),
        );
    });

    it.each([
        ["edge: nothing typed yet (not answerable)", () => undefined],
        ["edge: the shortcut is switched off in Settings", () => setLessonShortcutsEnabled(false)],
    ])("%s: Enter neither checks nor advances", (_name, arrange) => {
        arrange();
        mount();
        fireEvent.keyDown(window, {key: "Enter"});
        expect(hoisted.submitSpy).not.toHaveBeenCalled();
        expect(screen.getByTestId("review-step-review-s0")).toBeInTheDocument();
    });

    it("boundary: on the summary Enter does nothing", () => {
        hoisted.initialIndex.value = 2;
        mount();
        expect(screen.getByTestId("review-summary")).toBeInTheDocument();
        fireEvent.keyDown(window, {key: "Enter"});
        expect(hoisted.submitSpy).not.toHaveBeenCalled();
        expect(screen.getByTestId("review-summary")).toBeInTheDocument();
    });
});

describe("re-anchoring on the review runner (#3126 / #1422)", () => {
    it("reproduction + happy path: a step change scrolls the step anchor into view", async () => {
        mount();
        await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
        const callsAfterMount = scrollSpy.mock.calls.length;
        await answerAndCheck();
        fireEvent.click(screen.getByTestId("review-next"));
        await waitFor(() => expect(scrollSpy.mock.calls.length).toBeGreaterThan(callsAfterMount));
        const anchor = screen.getByTestId("review-step-anchor");
        expect(scrollSpy.mock.contexts).toContain(anchor);
    });

    it("edge: a device rotation re-anchors without a step change", async () => {
        mount();
        await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
        const callsAfterMount = scrollSpy.mock.calls.length;
        expect(orientationListeners.length).toBeGreaterThan(0);
        act(() => {
            for (const listener of orientationListeners) listener();
        });
        await waitFor(() => expect(scrollSpy.mock.calls.length).toBeGreaterThan(callsAfterMount));
    });

    it("boundary: a re-render without a step change does not re-anchor again", async () => {
        mount();
        await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
        const callsAfterMount = scrollSpy.mock.calls.length;
        fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "x"}});
        await waitFor(() => expect(screen.getByTestId("review-check")).not.toBeDisabled());
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(scrollSpy.mock.calls.length).toBe(callsAfterMount);
    });
});

describe("hint usage is cleared at run start (#3196)", () => {
    it("reproduction + happy path: a hint from an earlier run is forgotten at mount", () => {
        markHintUsed("ex-s0");
        mount();
        expect(wasHintUsed("ex-s0")).toBe(false);
    });

    it("edge: a hint revealed during the run survives a re-render", async () => {
        mount();
        markHintUsed("ex-s0");
        fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "x"}});
        await waitFor(() => expect(screen.getByTestId("review-check")).not.toBeDisabled());
        expect(wasHintUsed("ex-s0")).toBe(true);
    });

    it("boundary: another round is a new run and clears again", async () => {
        hoisted.initialIndex.value = 2;
        mount();
        markHintUsed("ex-s0");
        fireEvent.click(screen.getByTestId("review-another-round"));
        expect(hoisted.reloadSpy).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(wasHintUsed("ex-s0")).toBe(false));
    });
});

describe("answered-step lock on the review runner (#1790)", () => {
    it("reproduction + happy path: going back to an answered step locks it and records nothing twice", async () => {
        mount();
        await answerAndCheck();
        expect(hoisted.recordStepAttempts).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("review-next"));
        await waitFor(() =>
            expect(screen.getByTestId("review-step-review-s1")).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId("review-prev"));
        await waitFor(() =>
            expect(screen.getByTestId("review-step-review-s0")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "locked");
        expect(screen.queryByTestId("review-check")).toBeNull();
        expect(screen.getByTestId("review-next")).toBeInTheDocument();
        fireEvent.keyDown(window, {key: "Enter"});
        expect(hoisted.submitSpy).toHaveBeenCalledTimes(1);
        expect(hoisted.recordStepAttempts).toHaveBeenCalledTimes(1);
    });

    it("edge: going back to a step never answered keeps it open", async () => {
        hoisted.initialIndex.value = 1;
        mount();
        fireEvent.click(screen.getByTestId("review-prev"));
        await waitFor(() =>
            expect(screen.getByTestId("review-step-review-s0")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "open");
        expect(screen.getByTestId("review-check")).toBeInTheDocument();
        expect(hoisted.recordStepAttempts).not.toHaveBeenCalled();
    });

    it("boundary: the first step has no previous step", () => {
        mount();
        expect(screen.getByTestId("review-prev")).toBeDisabled();
    });
});
