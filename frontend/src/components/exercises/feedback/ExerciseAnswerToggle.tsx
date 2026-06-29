/**
 * ExerciseAnswerToggle (#1005).
 *
 * After an exercise is checked, the learner toggles between THEIR OWN
 * graded answer and the revealed correct SOLUTION. This generalises the
 * matching exercise's view toggle (#977 ``MatchingViewToggle``) into one
 * reusable control any exercise renderer can drop in.
 *
 * The active view is a filled (``default``) button carrying a Check; the
 * inactive view is an ``outline`` button. ``aria-pressed`` conveys the
 * active state to assistive tech. The caller owns the view state and the
 * two render branches; this component is pure presentation.
 *
 * Tailwind + design tokens only (shadcn ``Button``); works in every theme.
 *
 * @example
 * const [view, setView] = useState<AnswerView>("my-answer");
 * {submitted && (
 *   <ExerciseAnswerToggle
 *     view={view}
 *     onShowMyAnswer={() => setView("my-answer")}
 *     onShowSolution={() => setView("solution")}
 *     testIdPrefix="word-tiles"
 *   />
 * )}
 */

import {Check, Sparkles} from "lucide-react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../hooks/ui/useI18n";

/** Which answer view is currently shown. */
export type AnswerView = "my-answer" | "solution";

export interface ExerciseAnswerToggleProps {
    /** The active view (caller-owned state). */
    view: AnswerView;
    /** Switch to the learner's own graded answer. */
    onShowMyAnswer: () => void;
    /** Switch to the revealed correct solution. */
    onShowSolution: () => void;
    /** Prefix for the ``data-testid`` hooks, e.g. ``"word-tiles"`` ->
     *  ``word-tiles-answer-toggle`` / ``word-tiles-my-answer`` /
     *  ``word-tiles-solution``. */
    testIdPrefix?: string;
}

/**
 * Render the My-answer / Solution segmented toggle.
 *
 * @param props - See {@link ExerciseAnswerToggleProps}.
 */
export default function ExerciseAnswerToggle({
    view,
    onShowMyAnswer,
    onShowSolution,
    testIdPrefix = "exercise",
}: ExerciseAnswerToggleProps) {
    const {t} = useI18n();
    const myActive = view === "my-answer";
    const solutionActive = view === "solution";
    return (
        <div
            className="flex flex-wrap gap-2"
            role="group"
            data-testid={`${testIdPrefix}-answer-toggle`}
        >
            <Button
                type="button"
                variant={myActive ? "default" : "outline"}
                size="sm"
                aria-pressed={myActive}
                onClick={onShowMyAnswer}
                data-testid={`${testIdPrefix}-my-answer`}
            >
                {myActive && <Check size={14} aria-hidden="true" />}
                {t("lesson.exercise.toggle.my_answer", "My answer")}
            </Button>
            <Button
                type="button"
                variant={solutionActive ? "default" : "outline"}
                size="sm"
                aria-pressed={solutionActive}
                onClick={onShowSolution}
                data-testid={`${testIdPrefix}-solution`}
            >
                {solutionActive ? (
                    <Check size={14} aria-hidden="true" />
                ) : (
                    <Sparkles size={14} aria-hidden="true" />
                )}
                {t("lesson.exercise.toggle.solution", "Solution")}
            </Button>
        </div>
    );
}
