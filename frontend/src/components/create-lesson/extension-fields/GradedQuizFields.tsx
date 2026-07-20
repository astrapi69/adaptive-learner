/**
 * Authoring fields for ``ext:al-graded-quiz`` (#1852, editor 4): an optional
 * pass threshold plus a list of scored sub-questions ({@link SubQuestionEditor}
 * with points + optional partial credit). Pure + props-driven.
 */

import {Plus} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import SubQuestionEditor from "./SubQuestionEditor";
import {blankSubQuestion, type WizardSubQuestion} from "../../../lib/exercises";

type Translate = (key: string, fallback?: string) => string;

interface GqPayload {
    pass_threshold?: number;
    questions: WizardSubQuestion[];
}

export default function GradedQuizFields({
    id,
    payload,
    onChange,
    t,
}: {
    id: string;
    payload: GqPayload;
    onChange: (payload: GqPayload) => void;
    t: Translate;
}) {
    const threshold = payload?.pass_threshold ?? 60;
    const questions = payload?.questions ?? [];

    function setQuestion(index: number, next: WizardSubQuestion) {
        onChange({
            pass_threshold: threshold,
            questions: questions.map((q, i) => (i === index ? next : q)),
        });
    }

    return (
        <div className="flex flex-col gap-3">
            <label className="flex w-fit items-center gap-2 text-sm text-fg-secondary">
                {t("create_lesson.extensions.edit.gq_threshold_label", "Pass threshold (%)")}
                <Input
                    type="number"
                    min={0}
                    max={100}
                    value={String(threshold)}
                    className="w-24"
                    data-testid={`exercise-ext-gq-threshold-${id}`}
                    onChange={(e) =>
                        onChange({pass_threshold: Number(e.target.value) || 0, questions})
                    }
                />
            </label>

            <span className="form-label text-sm font-medium text-fg-primary">
                {t("create_lesson.extensions.edit.q_list_label", "Questions")}
            </span>
            <ul
                className="flex list-none flex-col gap-2 p-0"
                data-testid={`exercise-ext-gq-questions-${id}`}
            >
                {questions.map((question, i) => (
                    <SubQuestionEditor
                        key={i}
                        question={question}
                        index={i}
                        withPoints
                        canRemove={questions.length > 1}
                        onChange={(next) => setQuestion(i, next)}
                        onRemove={() =>
                            onChange({
                                pass_threshold: threshold,
                                questions: questions.filter((_q, k) => k !== i),
                            })
                        }
                        idPrefix={`exercise-ext-gq-q-${id}`}
                        t={t}
                    />
                ))}
            </ul>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                data-testid={`exercise-ext-gq-q-add-${id}`}
                onClick={() =>
                    onChange({
                        pass_threshold: threshold,
                        questions: [...questions, blankSubQuestion(true)],
                    })
                }
            >
                <Plus size={14} aria-hidden="true" />
                {t("create_lesson.extensions.edit.q_add", "Add question")}
            </Button>
        </div>
    );
}
