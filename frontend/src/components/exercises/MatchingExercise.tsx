/**
 * MatchingExercise (Phase 44 / EXP-002 / 3C — F-106).
 *
 * Two-column tap-to-pair exercise. Left column = terms in
 * authored order; right column = definitions, shuffled.
 * User taps a left tile (or selects via keyboard), then taps
 * a right tile to create a pair. Tapping a paired tile undoes
 * the pair. Submit enables once every pair is made.
 *
 * Accessibility:
 * - Each tile is a real ``<button>`` with an aria-pressed
 *   state. Keyboard users navigate via Tab; pairing happens
 *   on Enter / Space.
 * - aria-live announces the running pair count.
 *
 * Mobile-first: tap-to-pair. Drag-and-drop is an explicit
 * non-goal for v1.28.0 — tap-to-pair works everywhere and
 * keeps the touch surface above 44px without a DnD library.
 *
 * Result contract: the parent (viewer commit 6 wires this)
 * passes ``onComplete({correct, total})``. The viewer then
 * persists via ``recordStepResult`` and advances. Calling
 * ``onComplete`` twice is safe — the parent dedupes via
 * ``recordStepResult`` keyed by step id.
 */

import {ArrowRight, Check, X} from "lucide-react";
import {forwardRef, useEffect, useMemo, useState} from "react";
import type {CSSProperties, Ref} from "react";

import {useI18n} from "../../hooks/useI18n";
import {cn} from "@/lib/utils";
import ReadAloudButton from "../lesson/ReadAloudButton";
import {deriveMatchingAttempts} from "../../lib/element-attempt";
import {useControlledExercise} from "../../lib/exercises/useControlledExercise";
import {
    instructionKey,
    resolveConcreteDirection,
} from "../../lib/exercises/direction";
import type {ContentLessonExercise} from "../../storage/types";
import AnswerCelebration from "./AnswerCelebration";
import ExerciseFooter from "./ExerciseFooter";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "./exercise-control";

export interface MatchingExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    /** Content-set id + lesson id — Phase 46B context the
     *  exercise needs to derive per-element attempts for the
     *  SRS layer. Optional in unit tests; required in
     *  production (the viewer always passes them). Empty
     *  strings still produce attempts; the viewer's guard
     *  chain decides whether to persist. */
    setId?: string;
    lessonId?: string;
    /** Called when the user submits answers AND the parent
     *  should record the result. Receives the scored
     *  outcome AND a per-pair ``attempts`` list the viewer
     *  passes to ``elementErrors.recordBulk`` (Phase 46B). */
    onComplete: (result: ExerciseScored) => void;
    /** UX bugfix — BCP-47 codes of the lesson's language pair.
     *  When provided, the column headers show the actual
     *  language NAMES (e.g. "Français" / "Deutsch") instead of
     *  the generic "Term" / "Translation". Optional; the
     *  Review + AdaptiveLesson pages omit them and keep the
     *  generic labels. */
    targetLanguage?: string | null;
    sourceLanguage?: string | null;
    /** #149 — the lesson's domain. For a non-language domain (or a
     *  source==target knowledge set) the renderer drops the
     *  translation-specific wording: neutral Term / Definition
     *  column labels, no language names, a "match each term to its
     *  definition" instruction. Optional; absent = language behaviour. */
    domain?: string | null;
}

/** Localised display name for a BCP-47 language code, in the
 *  learner's UI language (e.g. ``("fr", "de")`` -> "Französisch").
 *  Returns null when the code is missing or unresolvable so the
 *  caller can fall back to a generic label. */
function _languageName(
    code: string | null | undefined,
    uiLang: string,
): string | null {
    if (!code) return null;
    try {
        const name = new Intl.DisplayNames([uiLang], {
            type: "language",
        }).of(code);
        // ``of`` echoes the code back when it can't resolve it.
        return name && name !== code ? name : null;
    } catch {
        return null;
    }
}

/** Count pairs whose left index matches its right originalIndex. */
function _scoreMatches(
    matches: ReadonlyMap<number, number>,
    total: number,
): {correct: number; total: number} {
    let correct = 0;
    for (const [leftIdx, rightOriginal] of matches) {
        if (leftIdx === rightOriginal) correct += 1;
    }
    return {correct, total};
}

/** #145 / #181 — number of distinct per-pair colors. Cycles modulo
 *  this for the rare exercise with more pairs than palette entries.
 *  Draws from the dedicated ``--matching-pair-N`` palette
 *  (``global.css``), a theme-agnostic, RED-FREE set of distinct hues
 *  (blue / green / orange / purple / teal / yellow / pink). Red is
 *  excluded on purpose: it universally reads as "wrong", so a correctly
 *  matched pair must never be tinted red. NOT the ``--chart-*`` palette
 *  (those are shared with data charts, where red is a valid series). */
export const MATCHING_PAIR_COLORS = 7;

/** Lowest non-negative slot not already assigned to a pair, so
 *  colors + labels stay compact (1, 2, 3 …) and an existing pair
 *  keeps its slot when another is added or removed. */
function _nextFreeSlot(slots: ReadonlyMap<number, number>): number {
    const used = new Set(slots.values());
    let slot = 0;
    while (used.has(slot)) slot += 1;
    return slot;
}

/** CSS custom-property reference to the pair color for ``slot``.
 *  Returns a token reference (``var(--matching-pair-N)``), never a
 *  literal, so it routes through the design-token system. */
export function matchingPairColorVar(slot: number): string {
    return `var(--matching-pair-${(slot % MATCHING_PAIR_COLORS) + 1})`;
}

/** #145 / #183 — number badge identifying a matched pair. The same
 *  number appears on both tiles of a pair, so the pairing is conveyed
 *  redundantly (not by color alone) for color-blind users. The number
 *  renders in ``--fg-primary`` on ``--bg-surface`` (always AA); the ring
 *  carries the state color.
 *
 *  ``tone`` selects the ring:
 *    - ``pair``    (before checking) — the per-pair color the tile sets
 *      via the ``--matching-pair-color`` custom property.
 *    - ``correct`` (after checking)  — green (``--exercise-correct``).
 *    - ``wrong``   (after checking)  — red (``--exercise-wrong``).
 *
 *  The badge stays visible AFTER checking too (#183 — it used to vanish
 *  on submit, losing the left<->right pairing link). */
function PairBadge({
    slot,
    tone = "pair",
}: {
    slot: number;
    tone?: "pair" | "correct" | "wrong";
}) {
    const ring =
        tone === "correct"
            ? "border-[var(--exercise-correct)]"
            : tone === "wrong"
              ? "border-[var(--exercise-wrong)]"
              : "border-[var(--matching-pair-color)]";
    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--bg-surface)] text-[0.625rem] font-bold text-[var(--fg-primary)]",
                ring,
            )}
            data-testid={`matching-pair-badge-${slot + 1}`}
        >
            {slot + 1}
        </span>
    );
}

interface LeftTile {
    index: number;
    label: string;
}

interface RightTile {
    /** Original index in the authored pairs list. */
    originalIndex: number;
    label: string;
}

/** Deterministic Fisher-Yates shuffle keyed by the
 *  exercise id so a reload reshuffles consistently within
 *  the same session but every fresh visit gets a new order. */
function _shuffle<T>(items: readonly T[], seed: string): T[] {
    const out = [...items];
    let acc = 0;
    for (const ch of seed) acc = (acc * 31 + ch.charCodeAt(0)) | 0;
    for (let i = out.length - 1; i > 0; i--) {
        acc = (acc * 1103515245 + 12345) & 0x7fffffff;
        const j = acc % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

type MatchingPairs = NonNullable<ContentLessonExercise["pairs"]>;
type Translate = (key: string, fallback?: string) => string;

interface MatchingLabels {
    direction: string;
    productive: boolean;
    isKnowledge: boolean;
    leftLabel: string;
    rightLabel: string;
    instruction: string;
}

/** Resolve the column labels + instruction for one matching exercise.
 *  Productive flips the displayed orientation; a knowledge domain drops
 *  the translation-specific wording. Pure (no hooks). */
function computeMatchingLabels(
    exercise: ContentLessonExercise,
    opts: {
        uiLang: string;
        targetLanguage: string | null;
        sourceLanguage: string | null;
        domain: string | null;
        t: Translate;
    },
): MatchingLabels {
    const {uiLang, targetLanguage, sourceLanguage, domain, t} = opts;
    const direction = resolveConcreteDirection(exercise.direction, exercise.id);
    const productive = direction === "source_to_target";
    const isKnowledge =
        (domain != null && domain !== "language") ||
        (!!targetLanguage && targetLanguage === sourceLanguage);
    const targetName = _languageName(targetLanguage, uiLang);
    const sourceName = _languageName(sourceLanguage, uiLang);
    const leftLangName = productive ? sourceName : targetName;
    const rightLangName = productive ? targetName : sourceName;
    const leftLabel = isKnowledge
        ? t("lesson.exercise.matching.left_label_knowledge", "Term")
        : (leftLangName ??
          (productive
              ? t("lesson.exercise.matching.left_label_productive", "Meaning")
              : t("lesson.exercise.matching.left_label", "Term")));
    const rightLabel = isKnowledge
        ? t("lesson.exercise.matching.right_label_knowledge", "Definition")
        : (rightLangName ??
          (productive
              ? t("lesson.exercise.matching.right_label_productive", "Term")
              : t("lesson.exercise.matching.right_label", "Translation")));
    const instruction = isKnowledge
        ? t(
              "lesson.exercise.matching.instruction_knowledge",
              "Match each term with its definition.",
          )
        : t(
              instructionKey("matching", direction),
              productive
                  ? "Match the pairs (Translation)"
                  : "Match the pairs (Recognition)",
          );
    return {direction, productive, isKnowledge, leftLabel, rightLabel, instruction};
}

interface LeftTileViewState {
    isSelected: boolean;
    isPaired: boolean;
    isCorrect: boolean;
    isWrong: boolean;
    slot: number | undefined;
    showPair: boolean;
    badgeTone: "pair" | "correct" | "wrong";
    correctPartner: string | undefined;
    chosenPartner: string | undefined;
    pairStyle: CSSProperties | undefined;
}

interface LeftTileContext {
    selectedLeft: number | null;
    matches: ReadonlyMap<number, number>;
    submitted: boolean;
    slotByLeft: ReadonlyMap<number, number>;
    pairs: MatchingPairs;
    productive: boolean;
}

/** Derived render state for one left tile (selection / pairing / grading
 *  / per-pair color / wrong-vs-correct partner labels). Pure. */
function computeLeftTileState(
    tile: LeftTile,
    ctx: LeftTileContext,
): LeftTileViewState {
    const {selectedLeft, matches, submitted, slotByLeft, pairs, productive} = ctx;
    const isPaired = matches.has(tile.index);
    const isCorrect = submitted && matches.get(tile.index) === tile.index;
    const isWrong =
        submitted && isPaired && matches.get(tile.index) !== tile.index;
    const slot = slotByLeft.get(tile.index);
    const showPair = isPaired && !submitted && slot !== undefined;
    const badgeTone = isCorrect ? "correct" : isWrong ? "wrong" : "pair";
    // The authored correct partner for this row, shown as a hint under a
    // wrong pair (#183).
    const correctPartner = productive
        ? pairs[tile.index]?.left
        : pairs[tile.index]?.right;
    // #191 — the partner the learner actually picked (their wrong answer),
    // in the same right-column label form as ``correctPartner``.
    const chosenRight = matches.get(tile.index);
    const chosenPartner =
        chosenRight !== undefined
            ? productive
                ? pairs[chosenRight]?.left
                : pairs[chosenRight]?.right
            : undefined;
    const pairStyle: CSSProperties | undefined =
        slot !== undefined && showPair
            ? ({
                  "--matching-pair-color": matchingPairColorVar(slot),
              } as CSSProperties)
            : undefined;
    return {
        isSelected: selectedLeft === tile.index,
        isPaired,
        isCorrect,
        isWrong,
        slot,
        showPair,
        badgeTone,
        correctPartner,
        chosenPartner,
        pairStyle,
    };
}

/** #191 — after checking, a WRONG pair spells out both sides, not color
 *  alone: the learner's pick ("Your answer", red + X) and the correct one
 *  ("Correct answer", green + Check, bold); a CORRECT pair confirms the
 *  link as one "A -> B" line. */
function MatchingTileFeedback({
    tile,
    state,
}: {
    tile: LeftTile;
    state: LeftTileViewState;
}) {
    const {t} = useI18n();
    const {isWrong, isCorrect, chosenPartner, correctPartner} = state;
    return (
        <>
            {isWrong && (
                <div
                    className="mt-1 flex flex-col gap-1"
                    data-testid={`matching-feedback-${tile.index}`}
                >
                    {chosenPartner && (
                        <p
                            className="m-0 flex items-center gap-1.5 rounded-sm border-l-2 border-[var(--exercise-wrong)] bg-[var(--matching-error-bg)] px-2 py-1 text-[0.8125rem] text-[var(--matching-error-fg)]"
                            data-testid={`matching-your-answer-${tile.index}`}
                        >
                            <X
                                size={13}
                                aria-hidden="true"
                                className="shrink-0 text-[var(--exercise-wrong)]"
                            />
                            {t(
                                "lesson.exercise.matching.your_answer",
                                "Your answer: {label}",
                            ).replace("{label}", chosenPartner)}
                        </p>
                    )}
                    {correctPartner && (
                        <p
                            className="m-0 flex items-center gap-1.5 rounded-sm border-l-2 border-dashed border-[var(--exercise-correct)] bg-[var(--matching-correct-bg)] px-2 py-1 text-[0.8125rem] font-semibold text-[var(--matching-correct-fg)]"
                            data-testid={`matching-correct-hint-${tile.index}`}
                        >
                            <Check
                                size={13}
                                aria-hidden="true"
                                className="shrink-0 text-[var(--exercise-correct)]"
                            />
                            {t(
                                "lesson.exercise.matching.correct_hint",
                                "Correct answer: {label}",
                            ).replace("{label}", correctPartner)}
                        </p>
                    )}
                </div>
            )}
            {isCorrect && correctPartner && (
                <p
                    className="m-0 mt-1 flex items-center gap-1 px-1 text-[0.75rem] text-[var(--fg-muted)]"
                    data-testid={`matching-pair-correct-${tile.index}`}
                >
                    <Check
                        size={12}
                        aria-hidden="true"
                        className="shrink-0 text-[var(--exercise-correct)]"
                    />
                    <span className="min-w-0 truncate">{tile.label}</span>
                    <ArrowRight size={12} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 truncate">{correctPartner}</span>
                </p>
            )}
        </>
    );
}

/** One left-column tile (term/meaning) plus its post-check feedback. */
function MatchingLeftTile({
    tile,
    state,
    onClick,
}: {
    tile: LeftTile;
    state: LeftTileViewState;
    onClick: () => void;
}) {
    const {
        isSelected,
        isPaired,
        isCorrect,
        isWrong,
        slot,
        showPair,
        badgeTone,
        pairStyle,
    } = state;
    return (
        <li key={tile.index} className="flex flex-col">
            <button
                type="button"
                style={pairStyle}
                className={cn(
                    "inline-flex min-h-11 w-full flex-1 cursor-pointer items-center gap-1.5 rounded-sm border border-[var(--border-strong)] bg-[var(--matching-side-a-bg)] px-3 py-2 text-left text-[0.9375rem] text-[var(--matching-side-a-fg)] transition-[background,border-color] duration-150 hover:border-[var(--accent)] disabled:cursor-not-allowed",
                    isSelected &&
                        "is-selected border-[3px] border-[var(--exercise-selected)] bg-[color-mix(in_srgb,var(--exercise-selected)_15%,var(--surface))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--exercise-selected)_30%,transparent)] motion-safe:scale-[1.02] motion-safe:animate-[matching-pulse_0.5s_ease-in-out_infinite_alternate]",
                    isPaired && "is-paired",
                    showPair &&
                        "border-2 border-[var(--matching-pair-color)] bg-[color-mix(in_srgb,var(--matching-pair-color)_18%,var(--bg-surface))] text-[var(--fg-primary)]",
                    isCorrect &&
                        "is-correct border-2 border-[var(--exercise-correct)] bg-[var(--matching-correct-bg)] text-[var(--matching-correct-fg)]",
                    isWrong &&
                        "is-wrong border-2 border-[var(--exercise-wrong)] bg-[var(--matching-error-bg)] text-[var(--matching-error-fg)] motion-safe:animate-[matching-shake_0.2s_ease-in-out]",
                )}
                onClick={onClick}
                aria-pressed={isSelected}
                disabled={isCorrect}
                data-testid={`matching-left-${tile.index}`}
            >
                {isPaired && slot !== undefined && (
                    <PairBadge slot={slot} tone={badgeTone} />
                )}
                <span className="min-w-0 flex-1">{tile.label}</span>
                {isCorrect && <Check size={14} aria-hidden="true" />}
                {isWrong && <X size={14} aria-hidden="true" />}
            </button>
            <MatchingTileFeedback tile={tile} state={state} />
        </li>
    );
}

interface RightTileViewState {
    isPaired: boolean;
    slot: number | undefined;
    showPair: boolean;
    isCorrect: boolean;
    isWrong: boolean;
    badgeTone: "pair" | "correct" | "wrong";
    pairStyle: CSSProperties | undefined;
    flashing: boolean;
}

interface RightTileContext {
    pairedRightIndices: ReadonlySet<number>;
    matches: ReadonlyMap<number, number>;
    slotByLeft: ReadonlyMap<number, number>;
    submitted: boolean;
    wrongFlash: {left: number; right: number} | null;
}

/** Derived render state for one right tile (mirrors the result of the
 *  pair the learner made onto both tiles). Pure. */
function computeRightTileState(
    tile: RightTile,
    ctx: RightTileContext,
): RightTileViewState {
    const {pairedRightIndices, matches, slotByLeft, submitted, wrongFlash} = ctx;
    const isPaired = pairedRightIndices.has(tile.originalIndex);
    const pairedLeftIdx = [...matches.entries()].find(
        ([, ri]) => ri === tile.originalIndex,
    )?.[0];
    const slot =
        pairedLeftIdx !== undefined ? slotByLeft.get(pairedLeftIdx) : undefined;
    const showPair = isPaired && !submitted && slot !== undefined;
    const isCorrect = submitted && pairedLeftIdx === tile.originalIndex;
    const isWrong =
        submitted &&
        pairedLeftIdx !== undefined &&
        pairedLeftIdx !== tile.originalIndex;
    const badgeTone = isCorrect ? "correct" : isWrong ? "wrong" : "pair";
    const pairStyle: CSSProperties | undefined =
        slot !== undefined && showPair
            ? ({
                  "--matching-pair-color": matchingPairColorVar(slot),
              } as CSSProperties)
            : undefined;
    const flashing =
        wrongFlash !== null && wrongFlash.right === tile.originalIndex;
    return {isPaired, slot, showPair, isCorrect, isWrong, badgeTone, pairStyle, flashing};
}

/** One right-column tile (definition/term). */
function MatchingRightTile({
    tile,
    state,
    submitted,
    onClick,
}: {
    tile: RightTile;
    state: RightTileViewState;
    submitted: boolean;
    onClick: () => void;
}) {
    const {isPaired, slot, showPair, isCorrect, isWrong, badgeTone, pairStyle, flashing} =
        state;
    return (
        <li key={tile.originalIndex} className="flex flex-col">
            <button
                type="button"
                style={pairStyle}
                className={cn(
                    "inline-flex min-h-11 w-full flex-1 cursor-pointer items-center gap-1.5 rounded-sm border border-[var(--border-strong)] bg-[var(--matching-side-b-bg)] px-3 py-2 text-left text-[0.9375rem] text-[var(--matching-side-b-fg)] transition-[background,border-color] duration-150 hover:border-[var(--accent)] disabled:cursor-not-allowed",
                    showPair &&
                        "border-2 border-[var(--matching-pair-color)] bg-[color-mix(in_srgb,var(--matching-pair-color)_18%,var(--bg-surface))] text-[var(--fg-primary)]",
                    // Unmatched after checking stays neutral.
                    submitted && !isPaired && "opacity-60",
                    isCorrect &&
                        "is-correct border-2 border-[var(--exercise-correct)] bg-[var(--matching-correct-bg)] text-[var(--matching-correct-fg)]",
                    isWrong &&
                        "is-wrong border-2 border-[var(--exercise-wrong)] bg-[var(--matching-error-bg)] text-[var(--matching-error-fg)]",
                    isPaired && "is-paired",
                    flashing &&
                        "is-flash motion-safe:animate-[matching-flash_600ms_ease]",
                )}
                onClick={onClick}
                disabled={submitted}
                data-testid={`matching-right-${tile.originalIndex}`}
            >
                {isPaired && slot !== undefined && (
                    <PairBadge slot={slot} tone={badgeTone} />
                )}
                <span className="min-w-0 flex-1">{tile.label}</span>
                {isCorrect && <Check size={14} aria-hidden="true" />}
                {isWrong && <X size={14} aria-hidden="true" />}
            </button>
        </li>
    );
}

/** The score line + celebration + the shared exercise footer. */
function MatchingResultFooter({
    submitted,
    result,
    controlled,
    canCheck,
    onCheck,
    onRetry,
}: {
    submitted: boolean;
    result: {correct: number; total: number} | null;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
}) {
    const {t} = useI18n();
    const allCorrect =
        result !== null && result.total > 0 && result.correct === result.total;
    const correct = result?.correct ?? 0;
    const total = result?.total ?? 0;
    return (
        <div className="flex flex-wrap items-center gap-3">
            {submitted && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 font-semibold",
                            allCorrect
                                ? "is-correct text-[var(--exercise-correct)]"
                                : "is-wrong text-[var(--exercise-wrong)]",
                        )}
                        data-testid="matching-result"
                        data-result={allCorrect ? "correct" : "wrong"}
                    >
                        {t(
                            "lesson.exercise.matching.result",
                            "Score: {correct} / {total}",
                        )
                            .replace("{correct}", String(correct))
                            .replace("{total}", String(total))}
                    </p>
                    <AnswerCelebration isCorrect={allCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="matching"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t("lesson.exercise.matching.submit", "Check answers")}
                retryLabel={t("lesson.exercise.matching.retry", "Try again")}
            />
        </div>
    );
}

/** Prompt + instruction + running counter + sr-only selection status +
 *  the first-pair flow hint, above the two tile columns. */
function MatchingPrompt({
    prompt,
    ttsLang,
    codeMode,
    instruction,
    matchedCount,
    totalPairs,
    selectedLeft,
    leftTiles,
    isKnowledge,
    submitted,
    leftLabel,
    rightLabel,
}: {
    prompt: string | undefined;
    ttsLang: string | null;
    codeMode: boolean;
    instruction: string;
    matchedCount: number;
    totalPairs: number;
    selectedLeft: number | null;
    leftTiles: LeftTile[];
    isKnowledge: boolean;
    submitted: boolean;
    leftLabel: string;
    rightLabel: string;
}) {
    const {t} = useI18n();
    return (
        <>
            <div className="exercise-prompt-row">
                <p className="m-0 font-medium" data-testid="matching-prompt">
                    {prompt}
                </p>
                {ttsLang && !codeMode && (
                    <ReadAloudButton
                        text={prompt ?? ""}
                        lang={ttsLang}
                        testId="matching-prompt"
                    />
                )}
            </div>

            <p
                className="exercise-direction-instruction"
                data-testid="direction-instruction-matching"
            >
                {instruction}
            </p>

            <p
                className="m-0 text-[0.8125rem] text-[var(--fg-muted)]"
                aria-live="polite"
                data-testid="matching-counter"
            >
                {t("lesson.exercise.matching.counter", "{matched} / {total} paired")
                    .replace("{matched}", String(matchedCount))
                    .replace("{total}", String(totalPairs))}
            </p>

            {/* UX bugfix — announce the current selection to screen
                readers (the visual highlight is not conveyed otherwise). */}
            <span
                className="sr-only"
                aria-live="polite"
                data-testid="matching-sr-status"
            >
                {selectedLeft !== null
                    ? t(
                          "lesson.exercise.matching.selected_sr",
                          "Selected: {label}",
                      ).replace("{label}", leftTiles[selectedLeft]?.label ?? "")
                    : ""}
            </span>

            <p
                className="m-0 text-[0.8125rem] text-[var(--fg-muted)]"
                data-testid="matching-instructions"
            >
                {isKnowledge
                    ? t(
                          "lesson.exercise.matching.instructions_knowledge",
                          "Select an item on the left, then its match on the right.",
                      )
                    : t(
                          "lesson.exercise.matching.instructions",
                          "Select an item on the left, then its matching translation on the right.",
                      )}
            </p>

            {/* First-pair flow hint: disappears once the learner has
                made their first pair (they understand the mechanic). */}
            {matchedCount === 0 && !submitted && (
                <p
                    className="m-0 inline-flex items-center gap-2 self-start rounded-sm border border-dashed border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] px-2.5 py-1 text-[0.8125rem] font-medium"
                    data-testid="matching-flow-hint"
                >
                    <span>{leftLabel}</span>
                    <span
                        className="font-bold text-[var(--accent-text)]"
                        aria-hidden="true"
                    >
                        &rarr;
                    </span>
                    <span>{rightLabel}</span>
                </p>
            )}
        </>
    );
}

function MatchingExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        targetLanguage = null,
        sourceLanguage = null,
        domain = null,
        ttsLang = null,
        codeMode = false,
    }: MatchingExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t, lang} = useI18n();
    const pairs = useMemo(() => exercise.pairs ?? [], [exercise.pairs]);
    const reviewedMatching =
        reviewed?.kind === "matching" ? reviewed : null;
    // EXP-018 / Phase 62: a productive drill shows the source-language
    // column on the left (the learner produces the target). Receptive
    // keeps the authored orientation (target left, source right). Only
    // the DISPLAYED label flips — pair indices (and thus scoring) are
    // unchanged, so pair i still matches right i.
    // #149 / EXP-018 — column labels + instruction (knowledge vs language,
    // receptive vs productive) resolved in one pure helper.
    const {productive, isKnowledge, leftLabel, rightLabel, instruction} =
        computeMatchingLabels(exercise, {
            uiLang: lang,
            targetLanguage,
            sourceLanguage,
            domain,
            t,
        });

    // Stable seed per-mount so reshuffling on every render
    // doesn't move the right column under the user.
    const [shuffleSeed] = useState(
        () => `${exercise.id}#${Date.now() & 0xffff}`,
    );

    const leftTiles: LeftTile[] = useMemo(
        () =>
            pairs.map((p, i) => ({
                index: i,
                label: productive ? p.right : p.left,
            })),
        [pairs, productive],
    );

    const rightTiles: RightTile[] = useMemo(() => {
        const indexed = pairs.map((p, i) => ({
            originalIndex: i,
            label: productive ? p.left : p.right,
        }));
        return _shuffle(indexed, shuffleSeed);
    }, [pairs, shuffleSeed, productive]);

    /** Currently-selected left index (waiting for a right
     *  click to complete the pair). null when nothing is
     *  selected. */
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    /** Map from left index → right's originalIndex. */
    const [matches, setMatches] = useState<Map<number, number>>(
        () =>
            reviewedMatching
                ? new Map(reviewedMatching.matches)
                : new Map(),
    );
    /** #145 — per-pair color/label slot, keyed by left index.
     *  Assigned when a pair is formed, freed when undone, so both
     *  tiles of a pair share a stable color + number. Only consulted
     *  before submit (graded tiles switch to correct/wrong colors). */
    const [slotByLeft, setSlotByLeft] = useState<Map<number, number>>(
        () => new Map(),
    );
    /** Wrong-flash trigger for visual feedback. */
    const [wrongFlash, setWrongFlash] = useState<{
        left: number;
        right: number;
    } | null>(null);

    useEffect(() => {
        if (wrongFlash === null) return;
        const id = window.setTimeout(() => setWrongFlash(null), 600);
        return () => window.clearTimeout(id);
    }, [wrongFlash]);

    const pairedRightIndices = useMemo(
        () => new Set(matches.values()),
        [matches],
    );

    const allPaired = matches.size === pairs.length;

    const reviewedResult = reviewedMatching
        ? _scoreMatches(new Map(reviewedMatching.matches), pairs.length)
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: allPaired,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const {correct} = _scoreMatches(matches, pairs.length);
            return {
                correct,
                total: pairs.length,
                attempts: deriveMatchingAttempts(
                    exercise,
                    {setId, lessonId},
                    matches,
                ),
                raw_answer: {
                    kind: "matching",
                    matches: [...matches.entries()],
                },
            };
        },
        resetAnswer: () => {
            setMatches(new Map());
            setSlotByLeft(new Map());
            setSelectedLeft(null);
        },
    });

    const releaseSlot = (leftIdx: number) => {
        setSlotByLeft((prev) => {
            if (!prev.has(leftIdx)) return prev;
            const next = new Map(prev);
            next.delete(leftIdx);
            return next;
        });
    };

    const handleLeftClick = (idx: number) => {
        if (submitted) return;
        // Tapping a paired left undoes the pair.
        if (matches.has(idx)) {
            const next = new Map(matches);
            next.delete(idx);
            setMatches(next);
            releaseSlot(idx);
            setSelectedLeft(null);
            return;
        }
        setSelectedLeft(idx === selectedLeft ? null : idx);
    };

    const handleRightClick = (originalIndex: number) => {
        if (submitted) return;
        // Tapping a paired right undoes the pair.
        const pairedLeft = [...matches.entries()].find(
            ([, ri]) => ri === originalIndex,
        );
        if (pairedLeft) {
            const next = new Map(matches);
            next.delete(pairedLeft[0]);
            setMatches(next);
            releaseSlot(pairedLeft[0]);
            return;
        }
        if (selectedLeft === null) return;
        const next = new Map(matches);
        next.set(selectedLeft, originalIndex);
        setMatches(next);
        setSlotByLeft((prev) => {
            const nextSlots = new Map(prev);
            nextSlots.set(selectedLeft, _nextFreeSlot(prev));
            return nextSlots;
        });
        setSelectedLeft(null);
    };

    if (pairs.length === 0) {
        return (
            <div data-testid="matching-empty">
                {t(
                    "lesson.exercise.matching.empty",
                    "This matching exercise has no pairs.",
                )}
            </div>
        );
    }

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="matching-exercise"
        >
            <MatchingPrompt
                prompt={exercise.prompt}
                ttsLang={ttsLang}
                codeMode={codeMode}
                instruction={instruction}
                matchedCount={matches.size}
                totalPairs={pairs.length}
                selectedLeft={selectedLeft}
                leftTiles={leftTiles}
                isKnowledge={isKnowledge}
                submitted={submitted}
                leftLabel={leftLabel}
                rightLabel={rightLabel}
            />

            <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                    <div
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]"
                        data-testid="matching-left-header"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[var(--matching-side-a-bg)] text-[0.625rem] font-bold text-[var(--matching-side-a-fg)] ring-1 ring-[var(--border-strong)]"
                        >
                            A
                        </span>
                        {leftLabel}
                    </div>
                    <ul
                        className="m-0 grid list-none grid-cols-1 [grid-auto-rows:1fr] gap-2 p-0"
                        data-testid="matching-left"
                        aria-label={leftLabel}
                    >
                        {leftTiles.map((tile) => (
                            <MatchingLeftTile
                                key={tile.index}
                                tile={tile}
                                state={computeLeftTileState(tile, {
                                    selectedLeft,
                                    matches,
                                    submitted,
                                    slotByLeft,
                                    pairs,
                                    productive,
                                })}
                                onClick={() => handleLeftClick(tile.index)}
                            />
                        ))}
                    </ul>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <div
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]"
                        data-testid="matching-right-header"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[var(--matching-side-b-bg)] text-[0.625rem] font-bold text-[var(--matching-side-b-fg)] ring-1 ring-[var(--border-strong)]"
                        >
                            B
                        </span>
                        {rightLabel}
                    </div>
                    <ul
                        className="m-0 grid list-none grid-cols-1 [grid-auto-rows:1fr] gap-2 p-0"
                        data-testid="matching-right"
                        aria-label={rightLabel}
                    >
                        {rightTiles.map((tile) => (
                            <MatchingRightTile
                                key={tile.originalIndex}
                                tile={tile}
                                state={computeRightTileState(tile, {
                                    pairedRightIndices,
                                    matches,
                                    slotByLeft,
                                    submitted,
                                    wrongFlash,
                                })}
                                submitted={submitted}
                                onClick={() => handleRightClick(tile.originalIndex)}
                            />
                        ))}
                    </ul>
                </div>
            </div>

            <MatchingResultFooter
                submitted={submitted}
                result={result}
                controlled={controlled}
                canCheck={allPaired}
                onCheck={submit}
                onRetry={reset}
            />
        </section>
    );
}

export default forwardRef(MatchingExercise);
