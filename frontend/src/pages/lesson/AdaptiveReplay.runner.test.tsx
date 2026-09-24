/**
 * Adaptive and Error Replay on the LessonRunner shell (EXP-052 slice 3, refs #3169).
 *
 * Parametrized across both runners where the behaviour is identical: the
 * page renders ``{prefix}-page`` FROM the shell with its policy; Enter
 * checks then advances (new for Adaptive, which had no Enter at all); the
 * view re-anchors after a step change and a rotation (#3126 / #1422, new
 * for both); hint usage is cleared at run start and only there (#3196);
 * going back to an answered step locks it (#1790) and records nothing a
 * second time.
 *
 * The Error Replay lock is the owner's MERGE CONDITION for its new
 * Previous button (ratified matrix: ``prevStep`` "ja (neu)", a read-only
 * look back): the answered step's input is locked and ``recordStepAttempts``
 * does not fire again (the call count is asserted through the storage
 * write it performs, one per call); a step left before answering stays
 * answerable; the first step has no previous. Replay-specific besides: the
 * "try again" round re-opens the still-wrong exercise while a hint from
 * round one still counts.
 *
 * The adaptive mode hook is a stateful mock; the replay runs its real
 * source from router state over mocked storage. ``ExerciseDispatcher`` is a
 * minimal controlled exercise reporting the ``reviewed`` lock; typing
 * "wrong" grades the answer wrong.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {markHintUsed, wasHintUsed} from "../../lib/hints/hint-usage";
import {setLessonShortcutsEnabled} from "../../lib/lesson/prefs/lessonShortcutsPref";

const hoisted = vi.hoisted(() => {
    const exStep = (id: string) => ({
        id,
        type: "exercise" as const,
        title: null,
        body: null,
        exercise: {id: `ex-${id}`, type: "cloze", prompt: "p", card_ids: []},
    });
    return {
        exStep,
        submitSpy: vi.fn(),
        recordStepAttempts: vi.fn().mockResolvedValue(undefined),
        recordBulk: vi.fn().mockResolvedValue([]),
        finalize: vi.fn().mockResolvedValue(undefined),
        lessonRunnerSpy: vi.fn(),
        adaptiveInitialIndex: {value: 0},
    };
});

vi.mock("../../hooks/lesson/modes/useAdaptiveLesson", async () => {
    const {useState} = await import("react");
    return {
        useAdaptiveLesson: () => {
            const [idx, setIdx] = useState(hoisted.adaptiveInitialIndex.value);
            const steps = [hoisted.exStep("adaptive-step-0-a"), hoisted.exStep("adaptive-step-1-b")];
            return {
                status: "ready",
                lesson: {id: "adaptive", title: "Adaptive lesson", estimated_minutes: 1, cards: [], steps},
                transparency: {tags: [], total_errors: 3, active_elements: 2, mastered_before: 0},
                currentStepIndex: idx,
                error: null,
                goNext: () => setIdx((i) => Math.min(i + 1, steps.length)),
                goPrev: () => setIdx((i) => Math.max(i - 1, 0)),
                recordStepAttempts: hoisted.recordStepAttempts,
                sessionScoreCorrect: 1,
                sessionScoreTotal: 2,
                masteredDelta: null,
                finalize: hoisted.finalize,
            };
        },
    };
});

vi.mock("../../storage", () => ({
    getStorage: () => ({elementErrors: {recordBulk: hoisted.recordBulk}}),
}));

vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1", projectId: null, language: "en"}),
}));

vi.mock("../../components/exercises/shell/ExerciseDispatcher", async (orig) => {
    const actual =
        await orig<typeof import("../../components/exercises/shell/ExerciseDispatcher")>();
    const {forwardRef, useImperativeHandle, useRef} = await import("react");
    type Props = {
        step: {exercise?: {id: string}};
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
        const value = useRef("");
        useImperativeHandle(ref, () => ({
            submit: () => {
                hoisted.submitSpy();
                const correct = value.current === "wrong" ? 0 : 1;
                void props.onComplete({
                    correct,
                    total: 1,
                    attempts: [{exercise_id: props.step.exercise?.id, element_key: "merci", correct: correct === 1}],
                    raw_answer: {kind: "cloze", inputs: [value.current]},
                });
            },
        }));
        return (
            <div data-testid="mock-exercise" data-reviewed={props.reviewed ? "locked" : "open"}>
                <input
                    data-testid="mock-input"
                    onChange={(e) => {
                        value.current = e.target.value;
                        props.onInteraction?.(true);
                    }}
                />
            </div>
        );
    });
    Mock.displayName = "MockExerciseDispatcher";
    return {...actual, ExerciseDispatcher: Mock};
});

vi.mock("../../components/lesson/runner/LessonRunner", async (orig) => {
    const actual = await orig<typeof import("../../components/lesson/runner/LessonRunner")>();
    const Spy = (props: Parameters<typeof actual.default>[0]) => {
        hoisted.lessonRunnerSpy(props);
        return actual.default(props);
    };
    return {...actual, default: Spy};
});

import AdaptiveLessonPage from "./AdaptiveLesson";
import ErrorReplayLesson from "./ErrorReplayLesson";
import {ADAPTIVE_POLICY, ERROR_REPLAY_POLICY} from "../../components/lesson/runner/policies";

const REPLAY_STATE = {
    exercises: [
        {id: "ex-a", type: "free_text", prompt: "a", card_ids: [], accept: ["x"], distractors: []},
        {id: "ex-b", type: "free_text", prompt: "b", card_ids: [], accept: ["x"], distractors: []},
    ],
    cards: [],
    lessonTitle: "Greetings",
};

type Runner = {
    prefix: "adaptive-lesson" | "error-replay";
    mount: () => void;
    policy: typeof ADAPTIVE_POLICY;
    firstStep: string;
    secondStep: string;
    /** How many recording writes one graded answer produces. */
    recorded: () => number;
};

function mountAdaptive() {
    render(
        <MemoryRouter initialEntries={["/adaptive-lesson/fr-a1"]}>
            <Routes>
                <Route path="/adaptive-lesson/:setId" element={<AdaptiveLessonPage />} />
                <Route path="/dashboard" element={<div data-testid="dashboard-stub" />} />
            </Routes>
        </MemoryRouter>,
    );
}

function mountReplay() {
    render(
        <MemoryRouter initialEntries={[{pathname: "/error-replay/slug/fr-a1/03.json", state: REPLAY_STATE}]}>
            <Routes>
                <Route path="/error-replay/:setSlug/:setId/:filename" element={<ErrorReplayLesson />} />
                <Route path="/lesson/:setSlug/:setId/:filename" element={<div data-testid="lesson-stub" />} />
            </Routes>
        </MemoryRouter>,
    );
}

const ADAPTIVE: Runner = {
    prefix: "adaptive-lesson",
    mount: mountAdaptive,
    policy: ADAPTIVE_POLICY,
    firstStep: "adaptive-lesson-step-adaptive-step-0-a",
    secondStep: "adaptive-lesson-step-adaptive-step-1-b",
    recorded: () => hoisted.recordStepAttempts.mock.calls.length,
};

const REPLAY: Runner = {
    prefix: "error-replay",
    mount: mountReplay,
    policy: ERROR_REPLAY_POLICY,
    firstStep: "error-replay-step-ex-a",
    secondStep: "error-replay-step-ex-b",
    recorded: () => hoisted.recordBulk.mock.calls.length,
};

const RUNNERS: [string, Runner][] = [
    ["adaptive", ADAPTIVE],
    ["error replay", REPLAY],
];

/** Answer the open step and check it (Check -> Next phase). */
async function answerAndCheck(prefix: string, value = "merci") {
    fireEvent.change(screen.getByTestId("mock-input"), {target: {value}});
    await waitFor(() => expect(screen.getByTestId(`${prefix}-check`)).not.toBeDisabled());
    fireEvent.click(screen.getByTestId(`${prefix}-check`));
    await waitFor(() => expect(screen.getByTestId(`${prefix}-next`)).toBeInTheDocument());
}

let scrollSpy: ReturnType<typeof vi.fn>;
let orientationListeners: Array<() => void>;

beforeEach(() => {
    hoisted.submitSpy.mockClear();
    hoisted.recordStepAttempts.mockClear();
    hoisted.recordBulk.mockClear();
    hoisted.finalize.mockClear();
    hoisted.lessonRunnerSpy.mockClear();
    hoisted.adaptiveInitialIndex.value = 0;
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

describe.each(RUNNERS)("%s renders through the LessonRunner shell (#3169)", (_name, runner) => {
    it("renders {prefix}-page FROM the shell with its own policy", () => {
        runner.mount();
        expect(screen.getByTestId(`${runner.prefix}-page`)).toBeInTheDocument();
        expect(hoisted.lessonRunnerSpy).toHaveBeenCalled();
        expect(hoisted.lessonRunnerSpy.mock.calls[0][0].policy).toBe(runner.policy);
    });

    it("keeps the page's chrome testids: back button, progress bar, the step, Previous, the footer check", () => {
        runner.mount();
        for (const suffix of ["back-btn", "progress-bar", "prev", "check"]) {
            expect(screen.getByTestId(`${runner.prefix}-${suffix}`)).toBeInTheDocument();
        }
        expect(screen.getByTestId(runner.firstStep)).toBeInTheDocument();
    });
});

describe.each(RUNNERS)("Enter shortcut on the %s runner", (_name, runner) => {
    it("reproduction + happy path: Enter checks the answered step, a second Enter advances", async () => {
        runner.mount();
        fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "merci"}});
        fireEvent.keyDown(window, {key: "Enter"});
        expect(hoisted.submitSpy).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByTestId(`${runner.prefix}-next`)).toBeInTheDocument());
        fireEvent.keyDown(window, {key: "Enter"});
        await waitFor(() => expect(screen.getByTestId(runner.secondStep)).toBeInTheDocument());
    });

    it.each([
        ["edge: nothing typed yet (not answerable)", () => undefined],
        ["edge: the shortcut is switched off in Settings", () => setLessonShortcutsEnabled(false)],
    ])("%s: Enter neither checks nor advances", (_edge, arrange) => {
        arrange();
        runner.mount();
        fireEvent.keyDown(window, {key: "Enter"});
        expect(hoisted.submitSpy).not.toHaveBeenCalled();
        expect(screen.getByTestId(`${runner.prefix}-check`)).toBeInTheDocument();
    });
});

describe.each(RUNNERS)("re-anchoring on the %s runner (#3126 / #1422)", (_name, runner) => {
    it("reproduction + happy path: a step change scrolls the step anchor into view", async () => {
        runner.mount();
        await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
        const callsAfterMount = scrollSpy.mock.calls.length;
        await answerAndCheck(runner.prefix);
        fireEvent.click(screen.getByTestId(`${runner.prefix}-next`));
        await waitFor(() => expect(scrollSpy.mock.calls.length).toBeGreaterThan(callsAfterMount));
        expect(scrollSpy.mock.contexts).toContain(screen.getByTestId(`${runner.prefix}-step-anchor`));
    });

    it("edge: a device rotation re-anchors without a step change", async () => {
        runner.mount();
        await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
        const callsAfterMount = scrollSpy.mock.calls.length;
        expect(orientationListeners.length).toBeGreaterThan(0);
        act(() => {
            for (const listener of orientationListeners) listener();
        });
        await waitFor(() => expect(scrollSpy.mock.calls.length).toBeGreaterThan(callsAfterMount));
    });

    it("boundary: a re-render without a step change does not re-anchor again", async () => {
        runner.mount();
        await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
        const callsAfterMount = scrollSpy.mock.calls.length;
        fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "x"}});
        await waitFor(() => expect(screen.getByTestId(`${runner.prefix}-check`)).not.toBeDisabled());
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(scrollSpy.mock.calls.length).toBe(callsAfterMount);
    });
});

describe.each(RUNNERS)("hint usage on the %s runner is per run (#3196)", (_name, runner) => {
    it("reproduction + happy path: a hint from an earlier run is forgotten at mount", () => {
        markHintUsed("ex-from-an-earlier-run");
        runner.mount();
        expect(wasHintUsed("ex-from-an-earlier-run")).toBe(false);
    });

    it("edge: a hint revealed during the run survives a step change", async () => {
        runner.mount();
        markHintUsed("ex-now");
        await answerAndCheck(runner.prefix);
        fireEvent.click(screen.getByTestId(`${runner.prefix}-next`));
        await waitFor(() => expect(screen.getByTestId(runner.secondStep)).toBeInTheDocument());
        expect(wasHintUsed("ex-now")).toBe(true);
    });
});

// The Error Replay rows are the owner's merge condition for its Previous.
describe.each(RUNNERS)("answered-step lock on the %s runner (#1790)", (_name, runner) => {
    it("merge condition: going back to an answered step locks the input and records nothing twice", async () => {
        runner.mount();
        await answerAndCheck(runner.prefix);
        expect(hoisted.submitSpy).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(runner.recorded()).toBe(1));
        fireEvent.click(screen.getByTestId(`${runner.prefix}-next`));
        await waitFor(() => expect(screen.getByTestId(runner.secondStep)).toBeInTheDocument());
        fireEvent.click(screen.getByTestId(`${runner.prefix}-prev`));
        await waitFor(() => expect(screen.getByTestId(runner.firstStep)).toBeInTheDocument());
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "locked");
        expect(screen.queryByTestId(`${runner.prefix}-check`)).toBeNull();
        fireEvent.keyDown(window, {key: "Enter"});
        await waitFor(() => expect(screen.getByTestId(runner.secondStep)).toBeInTheDocument());
        expect(hoisted.submitSpy).toHaveBeenCalledTimes(1);
        expect(runner.recorded()).toBe(1);
    });

    it("edge: going back before answering keeps the step answerable", async () => {
        runner.mount();
        await answerAndCheck(runner.prefix);
        fireEvent.click(screen.getByTestId(`${runner.prefix}-next`));
        await waitFor(() => expect(screen.getByTestId(runner.secondStep)).toBeInTheDocument());
        fireEvent.click(screen.getByTestId(`${runner.prefix}-prev`));
        await waitFor(() => expect(screen.getByTestId(runner.firstStep)).toBeInTheDocument());
        fireEvent.click(screen.getByTestId(`${runner.prefix}-next`));
        await waitFor(() => expect(screen.getByTestId(runner.secondStep)).toBeInTheDocument());
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "open");
        expect(screen.getByTestId(`${runner.prefix}-check`)).toBeInTheDocument();
        await answerAndCheck(runner.prefix);
        await waitFor(() => expect(runner.recorded()).toBe(2));
    });

    it("boundary: the first step has no previous step", () => {
        runner.mount();
        expect(screen.getByTestId(`${runner.prefix}-prev`)).toBeDisabled();
    });
});

describe("Error Replay: the try-again round (a section of the same run)", () => {
    it("re-opens the still-wrong exercise and keeps a hint revealed in round one", async () => {
        mountReplay();
        await answerAndCheck("error-replay", "merci");
        fireEvent.click(screen.getByTestId("error-replay-next"));
        await waitFor(() => expect(screen.getByTestId(REPLAY.secondStep)).toBeInTheDocument());
        markHintUsed("ex-b");
        await answerAndCheck("error-replay", "wrong");
        fireEvent.click(screen.getByTestId("error-replay-next"));
        fireEvent.click(await screen.findByTestId("error-replay-summary-retry"));
        await waitFor(() => expect(screen.getByTestId(REPLAY.secondStep)).toBeInTheDocument());
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "open");
        expect(screen.getByTestId("error-replay-check")).toBeInTheDocument();
        expect(screen.getByTestId("error-replay-prev")).toBeDisabled();
        expect(wasHintUsed("ex-b")).toBe(true);
    });

    it("the summary's Back to lesson and the header's back button leave to the lesson", async () => {
        mountReplay();
        fireEvent.click(screen.getByTestId("error-replay-back-btn"));
        expect(screen.getByTestId("lesson-stub")).toBeInTheDocument();
    });
});

describe("Adaptive: header extension and summary", () => {
    it("renders the transparency block under the title through headerExtra", () => {
        mountAdaptive();
        expect(screen.getByTestId("adaptive-transparency")).toBeInTheDocument();
        expect(screen.getByTestId("adaptive-transparency-errors")).toHaveTextContent("3");
    });

    it("the summary keeps its testids and the save row, and finalizes once", async () => {
        hoisted.adaptiveInitialIndex.value = 2;
        mountAdaptive();
        expect(screen.getByTestId("adaptive-lesson-summary")).toBeInTheDocument();
        expect(screen.getByTestId("adaptive-summary-score")).toHaveTextContent("1 / 2 (50%)");
        expect(screen.getByTestId("adaptive-save-row")).toBeInTheDocument();
        await waitFor(() => expect(hoisted.finalize).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByTestId("adaptive-summary-exit"));
        expect(screen.getByTestId("dashboard-stub")).toBeInTheDocument();
    });
});
