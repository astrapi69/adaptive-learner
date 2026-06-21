import type {AssessmentQuestion} from "../../types";

interface QuestionCardProps {
    question: AssessmentQuestion;
    /** Currently-selected answer ids (one for single, 0..N for multi). */
    selectedAnswerIds: string[];
    /**
     * For single-select questions: replaces the selection.
     * For multi-select: toggles the answer in the selection.
     * The page owns selection state; the component just fires
     * the intent.
     */
    onToggle: (answerId: string) => void;
    disabled?: boolean;
}

/**
 * One question + its answers. v0.4.0:
 *
 * - ``type: "single"`` → radio-group (mutually exclusive). Pre-v0.4.0
 *   shape; preserved verbatim so smoke-tests and Playwright specs
 *   keep working.
 * - ``type: "multi"`` → checkbox-group (one or more). Each answer is
 *   independently toggleable. The page state's array holds whichever
 *   subset the user picked.
 *
 * Pure presentation: the page owns selection state, this component
 * only fires ``onToggle`` and reflects ``selectedAnswerIds`` back
 * as aria-checked + the ``is-selected`` class hook.
 */
export default function QuestionCard({
    question,
    selectedAnswerIds,
    onToggle,
    disabled = false,
}: QuestionCardProps) {
    const isMulti = question.type === "multi";
    const role = isMulti ? "group" : "radiogroup";
    const buttonRole = isMulti ? "checkbox" : "radio";
    const selectedSet = new Set(selectedAnswerIds);

    return (
        <section
            className="question-card"
            data-testid={`question-card-${question.id}`}
            data-question-type={question.type}
            aria-labelledby={`q-${question.id}-text`}
        >
            <h2 id={`q-${question.id}-text`} className="question-text">
                {question.text}
            </h2>
            <div
                role={role}
                aria-labelledby={`q-${question.id}-text`}
                className={`question-answers question-answers-${question.type}`}
            >
                {question.answers.map((answer) => {
                    const selected = selectedSet.has(answer.id);
                    return (
                        <button
                            type="button"
                            key={answer.id}
                            role={buttonRole}
                            aria-checked={selected}
                            disabled={disabled}
                            data-testid={`question-${question.id}-answer-${answer.id}`}
                            className={`answer-option${selected ? " is-selected" : ""}`}
                            onClick={() => onToggle(answer.id)}
                        >
                            <span className="answer-bullet" aria-hidden="true">
                                {isMulti
                                    ? selected
                                        ? "☑"
                                        : "☐"
                                    : selected
                                      ? "●"
                                      : "○"}
                            </span>
                            <span className="answer-text">{answer.text}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
