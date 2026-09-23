/**
 * Shuffle and Endless on the LessonRunner shell (EXP-052 slice 2, refs #3169).
 *
 * Parametrized across both runners where the behaviour is identical: the
 * page renders ``{prefix}-page`` FROM the shell with its policy; Enter
 * checks then advances; the view re-anchors after a step change and a
 * rotation (#3126 / #1422, new for both); hint usage is cleared at run
 * start and only there (#3196); an adopted extension exercise is played
 * through the dispatcher with the two-phase Check (owner decision, both
 * pages used to treat only core types as exercises).
 *
 * Runner-specific: Shuffle's answered-step lock after Previous (#1790,
 * new: a second answer is no longer recorded); Endless's own step counter
 * (a repeated card is a fresh, answerable step), the pause and End in the
 * footer (Befund 2) and the pure-display stat line.
 *
 * Both mode hooks are stateful mocks; ``ExerciseDispatcher`` is a minimal
 * controlled exercise that reports its type and the ``reviewed`` lock.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {markHintUsed, wasHintUsed} from "../../lib/hints/hint-usage";
import {setLessonShortcutsEnabled} from "../../lib/lesson/prefs/lessonShortcutsPref";

const hoisted = vi.hoisted(() => {
    const cloze = (id: string, lessonId: string, type = "cloze") => ({
        id,
        type: "exercise" as const,
        title: null,
        review_lesson_id: lessonId,
        exercise: {id: `ex-${id}`, type, prompt: "p", card_ids: []},
    });
    return {
        cloze,
        submitSpy: vi.fn(),
        recordStepAttempts: vi.fn().mockResolvedValue(undefined),
        reloadSpy: vi.fn(),
        lessonRunnerSpy: vi.fn(),
        shuffleInitialIndex: {value: 0},
        exerciseType: {value: "cloze"},
        STATS: {cards: 45, correct: 38, reviewsDone: 3, newLearned: 2, errorsPracticed: 4, xp: 38},
    };
});

vi.mock("../../hooks/lesson/modes/useShuffleLesson", async () => {
    const {useState} = await import("react");
    return {
        useShuffleLesson: () => {
            const [idx, setIdx] = useState(hoisted.shuffleInitialIndex.value);
            const steps = [
                hoisted.cloze("shuffle-a-1", "a.json", hoisted.exerciseType.value),
                hoisted.cloze("shuffle-b-1", "b.json"),
            ];
            return {
                status: "ready",
                lesson: {id: "shuffle", title: "Shuffle session", estimated_minutes: 1, cards: [], steps},
                currentStepIndex: idx,
                sourceLessonCount: 2,
                error: null,
                goNext: () => setIdx((i) => Math.min(i + 1, steps.length)),
                goPrev: () => setIdx((i) => Math.max(i - 1, 0)),
                recordStepAttempts: hoisted.recordStepAttempts,
                sessionScoreCorrect: 1,
                sessionScoreTotal: 2,
                reload: () => {
                    hoisted.reloadSpy();
                    setIdx(0);
                },
            };
        },
    };
});

vi.mock("../../hooks/lesson/modes/useEndlessLesson", async () => {
    const {useState} = await import("react");
    return {
        useEndlessLesson: () => {
            const [idx, setIdx] = useState(0);
            // A two-card pool that REPEATS: card 2 is card 0 again (same id).
            const pool = [
                hoisted.cloze("endless-a-1", "a.json", hoisted.exerciseType.value),
                hoisted.cloze("endless-b-1", "b.json"),
            ];
            return {
                status: "ready",
                step: pool[idx % pool.length],
                cards: [],
                stats: hoisted.STATS,
                error: null,
                advance: () => setIdx((i) => i + 1),
                recordStepAttempts: hoisted.recordStepAttempts,
            };
        },
    };
});

vi.mock("../../components/exercises/shell/ExerciseDispatcher", async (orig) => {
    const actual =
        await orig<typeof import("../../components/exercises/shell/ExerciseDispatcher")>();
    const {forwardRef, useImperativeHandle} = await import("react");
    type Props = {
        step: {exercise?: {type: string}};
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
                data-exercise-type={props.step.exercise?.type}
                data-reviewed={props.reviewed ? "locked" : "open"}
            >
                <input data-testid="mock-input" onChange={() => props.onInteraction?.(true)} />
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

import EndlessLessonPage from "./EndlessLesson";
import ShuffleLessonPage from "./ShuffleLesson";
import {ENDLESS_POLICY, SHUFFLE_POLICY} from "../../components/lesson/runner/policies";

type Runner = {
    prefix: "shuffle" | "endless";
    mount: () => void;
    policy: typeof SHUFFLE_POLICY;
    firstStep: string;
    secondStep: string;
};

function mountAt(path: string, route: string, page: React.ReactElement) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path={route} element={page} />
                <Route path="/dashboard" element={<div data-testid="dashboard-stub" />} />
            </Routes>
        </MemoryRouter>,
    );
}

const SHUFFLE: Runner = {
    prefix: "shuffle",
    mount: () => mountAt("/shuffle-lesson/fr-a1", "/shuffle-lesson/:setId", <ShuffleLessonPage />),
    policy: SHUFFLE_POLICY,
    firstStep: "shuffle-step-shuffle-a-1",
    secondStep: "shuffle-step-shuffle-b-1",
};

const ENDLESS: Runner = {
    prefix: "endless",
    mount: () => mountAt("/endless-lesson/fr-a1", "/endless-lesson/:setId", <EndlessLessonPage />),
    policy: ENDLESS_POLICY,
    firstStep: "endless-step",
    secondStep: "endless-step",
};

const RUNNERS: [string, Runner][] = [
    ["shuffle", SHUFFLE],
    ["endless", ENDLESS],
];

/** Answer the open step and check it (Check -> Next phase). */
async function answerAndCheck(prefix: string) {
    fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "merci"}});
    await waitFor(() => expect(screen.getByTestId(`${prefix}-check`)).not.toBeDisabled());
    fireEvent.click(screen.getByTestId(`${prefix}-check`));
    await waitFor(() => expect(screen.getByTestId(`${prefix}-next`)).toBeInTheDocument());
}

let scrollSpy: ReturnType<typeof vi.fn>;
let orientationListeners: Array<() => void>;

beforeEach(() => {
    hoisted.submitSpy.mockClear();
    hoisted.recordStepAttempts.mockClear();
    hoisted.reloadSpy.mockClear();
    hoisted.lessonRunnerSpy.mockClear();
    hoisted.shuffleInitialIndex.value = 0;
    hoisted.exerciseType.value = "cloze";
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

    it("keeps the page's chrome testids: back button, the step, the footer check", () => {
        runner.mount();
        for (const id of [`${runner.prefix}-back-btn`, runner.firstStep, `${runner.prefix}-check`]) {
            expect(screen.getByTestId(id)).toBeInTheDocument();
        }
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
        await waitFor(() => expect(screen.getByTestId(`${runner.prefix}-check`)).toBeInTheDocument());
        expect(screen.getByTestId(runner.secondStep)).toBeInTheDocument();
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
        await waitFor(() => expect(screen.getByTestId(`${runner.prefix}-check`)).toBeInTheDocument());
        expect(wasHintUsed("ex-now")).toBe(true);
    });
});

describe.each(RUNNERS)("%s plays adopted extension exercises (owner decision)", (_name, runner) => {
    it("an ext:al-speak-and-record step renders through the dispatcher with the two-phase Check", async () => {
        hoisted.exerciseType.value = "ext:al-speak-and-record";
        runner.mount();
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute(
            "data-exercise-type",
            "ext:al-speak-and-record",
        );
        expect(screen.queryByTestId(`${runner.prefix}-no-card`)).toBeNull();
        await answerAndCheck(runner.prefix);
        expect(hoisted.recordStepAttempts).toHaveBeenCalledTimes(1);
    });
});

describe("answered-step lock on the shuffle runner (#1790, new)", () => {
    it("reproduction + happy path: going back to an answered step locks it and records nothing twice", async () => {
        SHUFFLE.mount();
        await answerAndCheck("shuffle");
        expect(hoisted.recordStepAttempts).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("shuffle-next"));
        await waitFor(() => expect(screen.getByTestId(SHUFFLE.secondStep)).toBeInTheDocument());
        fireEvent.click(screen.getByTestId("shuffle-prev"));
        await waitFor(() => expect(screen.getByTestId(SHUFFLE.firstStep)).toBeInTheDocument());
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "locked");
        expect(screen.queryByTestId("shuffle-check")).toBeNull();
        fireEvent.keyDown(window, {key: "Enter"});
        expect(hoisted.submitSpy).toHaveBeenCalledTimes(1);
        expect(hoisted.recordStepAttempts).toHaveBeenCalledTimes(1);
    });

    it("edge: going back to a step never answered keeps it open", async () => {
        hoisted.shuffleInitialIndex.value = 1;
        SHUFFLE.mount();
        fireEvent.click(screen.getByTestId("shuffle-prev"));
        await waitFor(() => expect(screen.getByTestId(SHUFFLE.firstStep)).toBeInTheDocument());
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "open");
        expect(screen.getByTestId("shuffle-check")).toBeInTheDocument();
    });

    it("boundary: the first step has no previous step", () => {
        SHUFFLE.mount();
        expect(screen.getByTestId("shuffle-prev")).toBeDisabled();
    });

    it("boundary: shuffle again is a new run, the lock is gone", async () => {
        hoisted.shuffleInitialIndex.value = 2;
        SHUFFLE.mount();
        expect(screen.getByTestId("shuffle-summary")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("shuffle-another-round"));
        expect(hoisted.reloadSpy).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByTestId(SHUFFLE.firstStep)).toBeInTheDocument());
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "open");
    });
});

describe("Endless: the stream's own step counter", () => {
    it("reproduction: a repeated card (same step id) is a fresh, answerable step", async () => {
        ENDLESS.mount();
        for (let i = 0; i < 2; i++) {
            await answerAndCheck("endless");
            fireEvent.click(screen.getByTestId("endless-next"));
            await waitFor(() => expect(screen.getByTestId("endless-check")).toBeInTheDocument());
        }
        // Third card is card 0 again: open, not locked, and recordable once more.
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-exercise-type", "cloze");
        expect(screen.getByTestId("mock-exercise")).toHaveAttribute("data-reviewed", "open");
        await answerAndCheck("endless");
        expect(hoisted.recordStepAttempts).toHaveBeenCalledTimes(3);
    });

    it("has no Previous button (prevStep false is structural)", () => {
        ENDLESS.mount();
        expect(screen.queryByTestId("endless-prev")).toBeNull();
    });
});

describe("Endless: pause and End in the footer (Befund 2)", () => {
    it("happy path: pause hides the step behind the notice, keeps the answer and switches Enter off", async () => {
        ENDLESS.mount();
        fireEvent.change(screen.getByTestId("mock-input"), {target: {value: "merci"}});
        fireEvent.click(screen.getByTestId("endless-pause"));
        expect(screen.getByTestId("endless-paused")).toBeInTheDocument();
        expect(screen.getByTestId("endless-step")).not.toBeVisible();
        expect(screen.queryByTestId("endless-check")).toBeNull();
        fireEvent.keyDown(window, {key: "Enter"});
        expect(hoisted.submitSpy).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("endless-pause"));
        expect(screen.queryByTestId("endless-paused")).toBeNull();
        expect(screen.getByTestId("endless-check")).not.toBeDisabled();
    });

    it("End from the footer shows the recap with its auto-focused sole exit, no footer", async () => {
        ENDLESS.mount();
        fireEvent.click(screen.getByTestId("endless-end"));
        const exit = await screen.findByTestId("endless-summary-exit");
        expect(exit).toHaveFocus();
        expect(screen.queryByTestId("endless-footer")).toBeNull();
        expect(screen.getAllByRole("main")).toHaveLength(1);
    });

    it("boundary: End while paused still reaches the recap", async () => {
        ENDLESS.mount();
        fireEvent.click(screen.getByTestId("endless-pause"));
        fireEvent.click(screen.getByTestId("endless-end"));
        expect(await screen.findByTestId("endless-summary")).toBeInTheDocument();
    });

    it("the stat line is pure display under its kept testid", () => {
        ENDLESS.mount();
        const line = screen.getByTestId("endless-stat-line");
        expect(line).toHaveTextContent("45 cards");
        expect(line).toHaveTextContent("38 correct (84%)");
        expect(line.querySelector("button")).toBeNull();
    });
});
