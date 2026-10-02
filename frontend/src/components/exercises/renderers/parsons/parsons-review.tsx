/**
 * Post-check view for ``ext:al-parsons`` (#3218). The editing surface
 * (``TileSequenceEditor``) unmounts once the answer is checked, which used
 * to leave the learner with a bare "Not quite" and no clue WHAT was wrong.
 * This view shows the answer as submitted, as code at the chosen depth,
 * with one verdict per line (right / wrong position / wrong indent with the
 * expected depth), and on a wrong answer the canonical solution below it.
 *
 * Pure presentation: the verdicts come from ``diagnoseParsonsLines``, which
 * uses the grader's own rules, so a line mark never contradicts the
 * overall result.
 *
 * @example
 * <ParsonsReview diagnosis={diagnosis} solution={lines} isCorrect={false} t={t} />
 */

import {Check, X} from "lucide-react";

import {cn} from "@/lib/utils";
import type {ParsonsLineDiagnosis} from "../../../../lib/exercises/grading/parsons-correctness";
import type {ParsonsLine} from "../../../../lib/exercises/payload/parsons";

type Translate = (key: string, fallback?: string) => string;

const I18N_PREFIX = "lesson.exercise.al_parsons";

/** One indent level rendered as this many character widths. */
const INDENT_CH = 2;

export interface ParsonsReviewProps {
    /** Per-slot verdicts for the submitted answer. */
    diagnosis: readonly ParsonsLineDiagnosis[];
    /** The canonical lines, shown as the solution after a wrong answer. */
    solution: readonly ParsonsLine[];
    isCorrect: boolean;
    t: Translate;
}

function lineVerdict(line: ParsonsLineDiagnosis, t: Translate): string {
    if (line.status === "wrong_position") {
        return t(`${I18N_PREFIX}.line_wrong_position`, "Wrong position");
    }
    if (line.status === "wrong_indent") {
        return t(`${I18N_PREFIX}.line_wrong_indent`, "Indent {actual}, expected {expected}")
            .replace("{actual}", String(line.indent))
            .replace("{expected}", String(line.expectedIndent));
    }
    return "";
}

function CodeLine({code, indent}: {code: string; indent: number}) {
    return (
        <code
            className="whitespace-pre font-mono text-sm"
            style={{paddingInlineStart: `${indent * INDENT_CH}ch`}}
        >
            {code}
        </code>
    );
}

export function ParsonsReview({diagnosis, solution, isCorrect, t}: ParsonsReviewProps) {
    return (
        <div className="flex flex-col gap-3" data-testid="parsons-review">
            <div className="flex flex-col gap-1">
                <p className="m-0 text-[0.8125rem] font-medium text-[var(--fg-muted)]">
                    {t(`${I18N_PREFIX}.review_heading`, "Your answer")}
                </p>
                <ol className="m-0 flex list-none flex-col gap-1 overflow-x-auto rounded-sm border border-[var(--border-accent)] bg-[var(--bg-elevated)] p-2">
                    {diagnosis.map((line, slot) => {
                        const ok = line.status === "correct";
                        return (
                            <li
                                key={slot}
                                className={cn(
                                    "flex items-center gap-2 rounded-sm px-1",
                                    !ok &&
                                        "bg-[color-mix(in_srgb,var(--exercise-wrong)_12%,transparent)]",
                                )}
                                data-testid={`parsons-review-line-${slot}`}
                                data-status={line.status}
                            >
                                {ok ? (
                                    <Check
                                        size={14}
                                        aria-hidden="true"
                                        className="shrink-0 text-[var(--exercise-correct)]"
                                    />
                                ) : (
                                    <X
                                        size={14}
                                        aria-hidden="true"
                                        className="shrink-0 text-[var(--exercise-wrong)]"
                                    />
                                )}
                                <CodeLine code={line.code} indent={line.indent} />
                                {!ok && (
                                    <span className="ml-auto shrink-0 pl-2 text-xs text-[var(--exercise-wrong)]">
                                        {lineVerdict(line, t)}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
            {!isCorrect && (
                <div className="flex flex-col gap-1">
                    <p className="m-0 text-[0.8125rem] font-medium text-[var(--exercise-correct)]">
                        {t(`${I18N_PREFIX}.solution_heading`, "Solution")}
                    </p>
                    <ol
                        className="m-0 flex list-none flex-col gap-1 overflow-x-auto rounded-sm border border-[var(--exercise-correct)] bg-[var(--bg-elevated)] p-2"
                        data-testid="parsons-solution"
                    >
                        {solution.map((line, slot) => (
                            <li key={slot} className="px-1">
                                <CodeLine code={line.code} indent={line.indent} />
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}
