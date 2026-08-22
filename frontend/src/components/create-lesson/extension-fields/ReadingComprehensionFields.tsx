/**
 * Authoring fields for ``ext:al-reading-comprehension`` (#1852, editor 3): a
 * reading passage plus a list of comprehension sub-questions
 * ({@link SubQuestionEditor}, no points). Pure + props-driven — the parent
 * owns the ``ext_payload``.
 */

import {Plus} from "lucide-react";

import {Button} from "@/components/ui/button";
import SubQuestionEditor from "./SubQuestionEditor";
import {AiSuggestButton} from "../fields";
import {suggestPassageForQuestions} from "../../../lib/ai/suggest/exercise-suggest";
import {blankSubQuestion, type WizardSubQuestion} from "../../../lib/exercises";

type Translate = (key: string, fallback?: string) => string;

interface RcPayload {
    passage: string;
    questions: WizardSubQuestion[];
}

export default function ReadingComprehensionFields({
    id,
    payload,
    onChange,
    t,
}: {
    id: string;
    payload: RcPayload;
    onChange: (payload: RcPayload) => void;
    t: Translate;
}) {
    const passage = payload?.passage ?? "";
    const questions = payload?.questions ?? [];

    function setQuestion(index: number, next: WizardSubQuestion) {
        onChange({passage, questions: questions.map((q, i) => (i === index ? next : q))});
    }

    // Offer an AI passage only while the passage is still empty (the state a
    // graded-quiz -> reading-comprehension conversion leaves it in) and at least
    // one question exists to steer it — never over a passage the author wrote.
    const questionPrompts = questions.map((question) => question.prompt);
    const canSuggestPassage =
        passage.trim().length === 0 &&
        questionPrompts.some((prompt) => prompt.trim().length > 0);

    return (
        <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fg-primary">
                    {t("create_lesson.extensions.edit.rc_passage_label", "Reading passage")}
                </span>
                <textarea
                    rows={4}
                    maxLength={4000}
                    value={passage}
                    className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-fg-primary"
                    placeholder={t(
                        "create_lesson.extensions.edit.rc_passage_placeholder",
                        "Paste the text the learner reads before answering.",
                    )}
                    data-testid={`exercise-ext-rc-passage-${id}`}
                    onChange={(e) => onChange({passage: e.target.value, questions})}
                />
            </label>
            {canSuggestPassage && (
                <AiSuggestButton
                    run={(provider) =>
                        suggestPassageForQuestions(questionPrompts, provider)
                    }
                    isEmpty={(result) => result === null}
                    onResult={(result) => {
                        if (result) onChange({passage: result, questions});
                    }}
                    label={t(
                        "create_lesson.suggest.passage",
                        "Suggest a passage with AI",
                    )}
                    emptyLabel={t(
                        "create_lesson.suggest.passage_empty",
                        "No usable passage — write one by hand.",
                    )}
                    testId={`exercise-ext-rc-suggest-${id}`}
                />
            )}

            <span className="text-sm font-medium text-fg-primary">
                {t("create_lesson.extensions.edit.q_list_label", "Questions")}
            </span>
            <ul
                className="flex list-none flex-col gap-2 p-0"
                data-testid={`exercise-ext-rc-questions-${id}`}
            >
                {questions.map((question, i) => (
                    <SubQuestionEditor
                        key={i}
                        question={question}
                        index={i}
                        withPoints={false}
                        canRemove={questions.length > 1}
                        onChange={(next) => setQuestion(i, next)}
                        onRemove={() =>
                            onChange({
                                passage,
                                questions: questions.filter((_q, k) => k !== i),
                            })
                        }
                        idPrefix={`exercise-ext-rc-q-${id}`}
                        t={t}
                    />
                ))}
            </ul>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                data-testid={`exercise-ext-rc-q-add-${id}`}
                onClick={() =>
                    onChange({passage, questions: [...questions, blankSubQuestion(false)]})
                }
            >
                <Plus size={14} aria-hidden="true" />
                {t("create_lesson.extensions.edit.q_add", "Add question")}
            </Button>
        </div>
    );
}
