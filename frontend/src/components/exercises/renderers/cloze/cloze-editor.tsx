/**
 * Cloze editing/display surfaces (#1782 — extracted from
 * ClozeExercise.tsx).
 *
 * Holds the prompt row, the single blank control (input/select), the
 * marker-interleaved sentence, and the select-mode choice groups.
 * Pure presentation — state and handlers arrive via props.
 */

import type {KeyboardEvent} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {cn} from "@/lib/utils";
import ReadAloudButton from "../../../lesson/tts/ReadAloudButton";
import InlineMarkdown from "../../../../shared/data-display/InlineMarkdown";
import ChoiceButtonGroup from "../../../../shared/forms/ChoiceButtonGroup";
import type {ClozeBlank} from "./cloze-types";

/** The prompt line + (non-code lessons only) the read-aloud control. */
export function ClozePromptRow({
    prompt,
    ttsLang,
    codeMode,
}: {
    prompt: string | undefined;
    ttsLang: string | null;
    codeMode: boolean;
}) {
    return (
        <div className="exercise-prompt-row">
            <p className="m-0 flex-auto font-medium" data-testid="cloze-prompt">
                <InlineMarkdown>{prompt ?? ""}</InlineMarkdown>
            </p>
            {ttsLang && !codeMode && (
                <ReadAloudButton
                    text={prompt ?? ""}
                    lang={ttsLang}
                    testId="cloze-prompt"
                />
            )}
        </div>
    );
}

/** A single blank control: an ``<input>`` (type mode) or ``<select>``
 *  (select mode) plus the optional inline per-blank hint, wrapped in a
 *  span that reflects the post-check correct/wrong state. */
function ClozeBlankControl({
    idx,
    blank,
    mode,
    submitted,
    isCorrect,
    value,
    options,
    onChange,
    onKeyDown,
    blankBase,
    blankState,
}: {
    idx: number;
    blank: ClozeBlank;
    mode: "type" | "select";
    submitted: boolean;
    isCorrect: boolean;
    value: string;
    options: string[] | undefined;
    onChange: (idx: number, value: string) => void;
    onKeyDown: (idx: number, event: KeyboardEvent) => void;
    blankBase: string;
    blankState: (idx: number) => string | false;
}) {
    const {t} = useI18n();
    const blankLabel =
        blank.hint ??
        t("lesson.exercise.cloze.blank_label", "Blank {n}").replace(
            "{n}",
            String(idx + 1),
        );
    return (
        <span
            className={cn(
                "mx-1 inline-flex flex-col items-stretch gap-0.5 align-baseline",
                submitted && (isCorrect ? "is-correct" : "is-wrong"),
            )}
            data-testid={`cloze-blank-${idx}`}
            data-result={
                submitted ? (isCorrect ? "correct" : "wrong") : "pending"
            }
        >
            {mode === "type" ? (
                <input
                    type="text"
                    className={cn(blankBase, blankState(idx))}
                    value={value}
                    onChange={(e) => onChange(idx, e.target.value)}
                    onKeyDown={(e) => onKeyDown(idx, e)}
                    disabled={submitted}
                    placeholder={blank.placeholder ?? "?"}
                    aria-label={blankLabel}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-testid={`cloze-input-${idx}`}
                />
            ) : (
                <select
                    className={cn(blankBase, blankState(idx))}
                    value={value}
                    onChange={(e) => onChange(idx, e.target.value)}
                    onKeyDown={(e) => onKeyDown(idx, e)}
                    disabled={submitted}
                    aria-label={blankLabel}
                    data-testid={`cloze-select-${idx}`}
                >
                    <option value="">
                        {t(
                            "lesson.exercise.cloze.select_placeholder",
                            "Choose…",
                        )}
                    </option>
                    {options?.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            )}
            {blank.hint && !submitted && (
                <span
                    className="text-xs italic text-[var(--fg-muted)]"
                    data-testid={`cloze-blank-hint-${idx}`}
                >
                    {blank.hint}
                </span>
            )}
        </span>
    );
}

/** The cloze sentence: the marker-split segments interleaved with one
 *  blank control per blank. Each blank reflects its post-check
 *  correct/wrong state once ``submitted``. */
export function ClozeSentence({
    segments,
    blanks,
    mode,
    submitted,
    perBlankCorrect,
    inputs,
    selectOptions,
    onChange,
    onKeyDown,
    blankBase,
    blankState,
    codeMode,
}: {
    segments: string[];
    blanks: readonly ClozeBlank[];
    mode: "type" | "select";
    submitted: boolean;
    perBlankCorrect: boolean[];
    inputs: string[];
    selectOptions: string[][];
    onChange: (idx: number, value: string) => void;
    onKeyDown: (idx: number, event: KeyboardEvent) => void;
    blankBase: string;
    blankState: (idx: number) => string | false;
    codeMode: boolean;
}) {
    const {t} = useI18n();
    return (
        <p
            className={cn(
                "m-0 rounded-sm bg-[var(--surface-2)] p-3 text-[1.0625rem] leading-[1.8]",
                codeMode && "cloze-sentence-code",
            )}
            data-testid="cloze-sentence"
            aria-label={t(
                "lesson.exercise.cloze.sentence_label",
                "Cloze sentence",
            )}
        >
            {segments.map((segment, segIdx) => (
                <span key={`seg-${segIdx}`} className="inline">
                    <InlineMarkdown>{segment}</InlineMarkdown>
                    {segIdx < blanks.length && (
                        <ClozeBlankControl
                            idx={segIdx}
                            blank={blanks[segIdx]}
                            mode={mode}
                            submitted={submitted}
                            isCorrect={perBlankCorrect[segIdx]}
                            value={inputs[segIdx]}
                            options={selectOptions[segIdx]}
                            onChange={onChange}
                            onKeyDown={onKeyDown}
                            blankBase={blankBase}
                            blankState={blankState}
                        />
                    )}
                </span>
            ))}
        </p>
    );
}

/** Select-mode (multiple-choice) rendering: the answer options as a tappable
 *  button radiogroup per blank (replaces the native `<select>`, which mis-hits
 *  on iOS — #1341). One group per blank; a non-empty surrounding sentence is
 *  shown above with the current pick chipped into the blank. The data model
 *  (accept[0] + distractors, seeded shuffle) is unchanged. */
export function ClozeSelectChoices({
    segments,
    blanks,
    submitted,
    inputs,
    selectOptions,
    perBlankCorrect,
    onChange,
}: {
    segments: string[];
    blanks: readonly ClozeBlank[];
    submitted: boolean;
    inputs: string[];
    selectOptions: string[][];
    perBlankCorrect: boolean[];
    onChange: (idx: number, value: string) => void;
}) {
    const {t} = useI18n();
    const hasText = segments.some((s) => s.trim() !== "");
    return (
        <div className="flex flex-col gap-3" data-testid="cloze-choices">
            {hasText && (
                <p
                    className="m-0 rounded-sm bg-[var(--surface-2)] p-3 text-[1.0625rem] leading-[1.8]"
                    data-testid="cloze-sentence"
                >
                    {segments.map((segment, segIdx) => (
                        <span key={`seg-${segIdx}`} className="inline">
                            <InlineMarkdown>{segment}</InlineMarkdown>
                            {segIdx < blanks.length && (
                                <span
                                    className="mx-1 rounded-sm bg-[var(--surface)] px-2 py-0.5 font-semibold"
                                    data-testid={`cloze-selected-${segIdx}`}
                                >
                                    {inputs[segIdx] || "___"}
                                </span>
                            )}
                        </span>
                    ))}
                </p>
            )}
            {blanks.map((blank, idx) => {
                const correct = blank.accept[0] ?? "";
                const picked = inputs[idx] ?? "";
                return (
                    <ChoiceButtonGroup
                        key={`choices-${idx}`}
                        options={selectOptions[idx] ?? []}
                        value={picked || null}
                        onChange={(value) => onChange(idx, value)}
                        ariaLabel={
                            blank.hint ??
                            t(
                                "lesson.exercise.cloze.blank_label",
                                "Blank {n}",
                            ).replace("{n}", String(idx + 1))
                        }
                        locked={submitted}
                        stateFor={
                            submitted
                                ? (opt) =>
                                      opt === correct
                                          ? "correct"
                                          : opt === picked && !perBlankCorrect[idx]
                                            ? "wrong"
                                            : undefined
                                : undefined
                        }
                        testIdPrefix={`cloze-option-${idx}`}
                        groupTestId={`cloze-choices-${idx}`}
                    />
                );
            })}
        </div>
    );
}
