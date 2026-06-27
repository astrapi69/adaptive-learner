/**
 * Presentational parts + pure helpers for MatchingExercise (extracted for
 * the complexity + file-size burn-down, #431). Column labels/instruction
 * resolution, per-tile view-state, the left/right tile components + their
 * feedback, the prompt header, and the result footer. Kept here (not in
 * MatchingExercise.tsx) so neither file crosses the size gate; no imports
 * back from MatchingExercise, so there is no cycle.
 */

import {ArrowRight, Check, Sparkles, X} from "lucide-react";
import type {CSSProperties} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import ReadAloudButton from "../../lesson/tts/ReadAloudButton";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import {
    instructionKey,
    resolveConcreteDirection,
} from "../../../lib/exercises/direction";
import type {ContentLessonExercise} from "../../../storage/types";
import AnswerCelebration from "../feedback/AnswerCelebration";
import ExerciseFooter from "../shell/ExerciseFooter";

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

/** #145 / #181 — number of distinct per-pair colors. Cycles modulo
 *  this for the rare exercise with more pairs than palette entries.
 *  Draws from the dedicated ``--matching-pair-N`` palette
 *  (``global.css``), a theme-agnostic, RED-FREE set of distinct hues
 *  (blue / green / orange / purple / teal / yellow / pink). Red is
 *  excluded on purpose: it universally reads as "wrong", so a correctly
 *  matched pair must never be tinted red. NOT the ``--chart-*`` palette
 *  (those are shared with data charts, where red is a valid series). */
export const MATCHING_PAIR_COLORS = 7;

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

export interface LeftTile {
    index: number;
    label: string;
}

export interface RightTile {
    /** Original index in the authored pairs list. */
    originalIndex: number;
    label: string;
}

export type MatchingPairs = NonNullable<ContentLessonExercise["pairs"]>;
type Translate = (key: string, fallback?: string) => string;

/** The value displayed in the right column for pair ``index`` — the
 *  side the learner matches against (``.left`` in a productive drill,
 *  ``.right`` otherwise). */
export function matchingRightValue(
    pairs: MatchingPairs,
    productive: boolean,
    index: number,
): string {
    return (productive ? pairs[index]?.left : pairs[index]?.right) ?? "";
}

/** True when pairing left pair ``leftIdx`` with the right tile that
 *  originally belonged to pair ``rightOriginal`` is correct. Compares
 *  the displayed VALUES, not the indices, so duplicate right-column
 *  values (e.g. "el" for both ``libro`` and ``coche``) are
 *  interchangeable: any tile carrying the right value is accepted, as
 *  long as the overall assignment is a bijection (enforced because each
 *  right tile can be paired only once). */
export function matchingPairIsCorrect(
    pairs: MatchingPairs,
    productive: boolean,
    leftIdx: number,
    rightOriginal: number,
): boolean {
    return (
        matchingRightValue(pairs, productive, leftIdx) ===
        matchingRightValue(pairs, productive, rightOriginal)
    );
}

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
export function computeMatchingLabels(
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
export function computeLeftTileState(
    tile: LeftTile,
    ctx: LeftTileContext,
): LeftTileViewState {
    const {selectedLeft, matches, submitted, slotByLeft, pairs, productive} = ctx;
    const isPaired = matches.has(tile.index);
    const chosenRight = matches.get(tile.index);
    // Correct by VALUE, not index — duplicate right-column values are
    // interchangeable (e.g. "el" for both libro and coche).
    const isPairCorrect =
        chosenRight !== undefined &&
        matchingPairIsCorrect(pairs, productive, tile.index, chosenRight);
    const isCorrect = submitted && isPairCorrect;
    const isWrong = submitted && isPaired && !isPairCorrect;
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
                    <span className="min-w-0 truncate">
                        <InlineMarkdown>{tile.label}</InlineMarkdown>
                    </span>
                    <ArrowRight size={12} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 truncate">
                        <InlineMarkdown>{correctPartner}</InlineMarkdown>
                    </span>
                </p>
            )}
        </>
    );
}

/** One left-column tile (term/meaning) plus its post-check feedback. */
export function MatchingLeftTile({
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
                <span className="min-w-0 flex-1">
                    <InlineMarkdown>{tile.label}</InlineMarkdown>
                </span>
                {isCorrect && <Check size={14} aria-hidden="true" />}
                {isWrong && <X size={14} aria-hidden="true" />}
            </button>
            <MatchingTileFeedback tile={tile} state={state} />
        </li>
    );
}

interface RightTileViewState {
    isSelected: boolean;
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
    pairs: MatchingPairs;
    productive: boolean;
    /** #507 — the right tile selected first in a B → A pairing. */
    selectedRight: number | null;
}

/** Derived render state for one right tile (mirrors the result of the
 *  pair the learner made onto both tiles). Pure. */
export function computeRightTileState(
    tile: RightTile,
    ctx: RightTileContext,
): RightTileViewState {
    const {
        pairedRightIndices,
        matches,
        slotByLeft,
        submitted,
        wrongFlash,
        pairs,
        productive,
        selectedRight,
    } = ctx;
    const isSelected = selectedRight === tile.originalIndex;
    const isPaired = pairedRightIndices.has(tile.originalIndex);
    const pairedLeftIdx = [...matches.entries()].find(
        ([, ri]) => ri === tile.originalIndex,
    )?.[0];
    const slot =
        pairedLeftIdx !== undefined ? slotByLeft.get(pairedLeftIdx) : undefined;
    const showPair = isPaired && !submitted && slot !== undefined;
    // Correct by VALUE, not index — the tile a learner paired is right
    // when its value equals the value its matched left pair expects, so
    // duplicate right-column values are interchangeable.
    const pairCorrect =
        pairedLeftIdx !== undefined &&
        matchingPairIsCorrect(pairs, productive, pairedLeftIdx, tile.originalIndex);
    const isCorrect = submitted && pairCorrect;
    const isWrong = submitted && pairedLeftIdx !== undefined && !pairCorrect;
    const badgeTone = isCorrect ? "correct" : isWrong ? "wrong" : "pair";
    const pairStyle: CSSProperties | undefined =
        slot !== undefined && showPair
            ? ({
                  "--matching-pair-color": matchingPairColorVar(slot),
              } as CSSProperties)
            : undefined;
    const flashing =
        wrongFlash !== null && wrongFlash.right === tile.originalIndex;
    return {
        isSelected,
        isPaired,
        slot,
        showPair,
        isCorrect,
        isWrong,
        badgeTone,
        pairStyle,
        flashing,
    };
}

/** One right-column tile (definition/term). */
export function MatchingRightTile({
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
    const {
        isSelected,
        isPaired,
        slot,
        showPair,
        isCorrect,
        isWrong,
        badgeTone,
        pairStyle,
        flashing,
    } = state;
    return (
        <li key={tile.originalIndex} className="flex flex-col">
            <button
                type="button"
                style={pairStyle}
                className={cn(
                    "inline-flex min-h-11 w-full flex-1 cursor-pointer items-center gap-1.5 rounded-sm border border-[var(--border-strong)] bg-[var(--matching-side-b-bg)] px-3 py-2 text-left text-[0.9375rem] text-[var(--matching-side-b-fg)] transition-[background,border-color] duration-150 hover:border-[var(--accent)] disabled:cursor-not-allowed",
                    // #507 — selected first in a B → A pairing (mirrors the
                    // left tile's selected affordance).
                    isSelected &&
                        "is-selected border-[3px] border-[var(--exercise-selected)] bg-[color-mix(in_srgb,var(--exercise-selected)_15%,var(--surface))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--exercise-selected)_30%,transparent)] motion-safe:scale-[1.02] motion-safe:animate-[matching-pulse_0.5s_ease-in-out_infinite_alternate]",
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
                aria-pressed={isSelected}
                disabled={submitted}
                data-testid={`matching-right-${tile.originalIndex}`}
            >
                {isPaired && slot !== undefined && (
                    <PairBadge slot={slot} tone={badgeTone} />
                )}
                <span className="min-w-0 flex-1">
                    <InlineMarkdown>{tile.label}</InlineMarkdown>
                </span>
                {isCorrect && <Check size={14} aria-hidden="true" />}
                {isWrong && <X size={14} aria-hidden="true" />}
            </button>
        </li>
    );
}

/** #977 — after checking, the learner toggles between their own graded
 *  answers and the revealed solution. The active view is a ``default``
 *  (filled) button carrying a Check; the inactive view is an ``outline``
 *  button. ``aria-pressed`` conveys the active state to assistive tech.
 *  Shown only after submit (the caller gates it). */
export function MatchingViewToggle({
    view,
    onShowUserAnswers,
    onShowSolution,
    myAnswersLabel,
    solveLabel,
}: {
    view: "user-answers" | "solution";
    onShowUserAnswers: () => void;
    onShowSolution: () => void;
    myAnswersLabel: string;
    solveLabel: string;
}) {
    const userActive = view === "user-answers";
    const solutionActive = view === "solution";
    return (
        <div
            className="flex flex-wrap gap-2"
            role="group"
            data-testid="matching-view-toggle"
        >
            <Button
                type="button"
                variant={userActive ? "default" : "outline"}
                size="sm"
                aria-pressed={userActive}
                onClick={onShowUserAnswers}
                data-testid="matching-my-answers"
            >
                {userActive && <Check size={14} aria-hidden="true" />}
                {myAnswersLabel}
            </Button>
            <Button
                type="button"
                variant={solutionActive ? "default" : "outline"}
                size="sm"
                aria-pressed={solutionActive}
                onClick={onShowSolution}
                data-testid="matching-resolve"
            >
                {solutionActive ? (
                    <Check size={14} aria-hidden="true" />
                ) : (
                    <Sparkles size={14} aria-hidden="true" />
                )}
                {solveLabel}
            </Button>
        </div>
    );
}

/** The score line + celebration + the shared exercise footer (check /
 *  retry). The #977 view toggle lives in its own row above the views. */
export function MatchingResultFooter({
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
export function MatchingPrompt({
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
                    <InlineMarkdown>{prompt ?? ""}</InlineMarkdown>
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
