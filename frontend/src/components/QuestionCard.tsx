import type {AssessmentQuestion} from "../types";

interface QuestionCardProps {
    question: AssessmentQuestion;
    /** Currently-selected answer id, or null when nothing picked. */
    selectedAnswerId: string | null;
    onSelect: (answerId: string) => void;
    disabled?: boolean;
}

/**
 * One question + its answers as a radio-group. Pure
 * presentation: the page owns selection state, this component
 * only fires ``onSelect`` and reflects the ``selectedAnswerId``
 * back as aria-checked + the ``is-selected`` class hook.
 */
export default function QuestionCard({
    question,
    selectedAnswerId,
    onSelect,
    disabled = false,
}: QuestionCardProps) {
    return (
        <section
            className="question-card"
            data-testid={`question-card-${question.id}`}
            aria-labelledby={`q-${question.id}-text`}
        >
            <h2 id={`q-${question.id}-text`} className="question-text">
                {question.text}
            </h2>
            <div
                role="radiogroup"
                aria-labelledby={`q-${question.id}-text`}
                className="question-answers"
            >
                {question.answers.map((answer) => {
                    const selected = answer.id === selectedAnswerId;
                    return (
                        <button
                            type="button"
                            key={answer.id}
                            role="radio"
                            aria-checked={selected}
                            disabled={disabled}
                            data-testid={`question-${question.id}-answer-${answer.id}`}
                            className={`answer-option${selected ? " is-selected" : ""}`}
                            onClick={() => onSelect(answer.id)}
                        >
                            <span className="answer-bullet" aria-hidden="true">
                                {selected ? "●" : "○"}
                            </span>
                            <span className="answer-text">{answer.text}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
