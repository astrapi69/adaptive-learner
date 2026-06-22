/**
 * MatchingResolution (#824).
 *
 * After the learner clicks "Auflösen" on a checked matching exercise,
 * this presentational component reveals the CORRECT pairs with one of
 * four animated effects (slide / color / connect / stack). It replaces
 * the interactive two-column grid: the pairs are shown correctly
 * matched and are no longer editable.
 *
 * Accessibility:
 * - ``reduceMotion`` (resolved by the caller from ``prefers-reduced-motion``)
 *   drops every animation utility so motion-sensitive users see the end
 *   result immediately.
 * - An ``aria-live`` region announces how many pairs the learner had
 *   originally matched correctly.
 *
 * Pure presentation: all colors route through the design-token
 * ``--matching-pair-*`` palette via {@link matchingPairColorVar}; no
 * external animation library (Tailwind + CSS ``@keyframes`` only).
 */

import {ArrowRight} from "lucide-react";
import type {CSSProperties} from "react";

import {cn} from "@/lib/utils";
import {useI18n} from "../../hooks/ui/useI18n";
import InlineMarkdown from "../../shared/data-display/InlineMarkdown";
import {matchingPairColorVar} from "./matching-parts";
import type {MatchingResolveEffect} from "../../lib/learning/matchingResolvePref";

/** One correct pair, ready to render. ``slot`` cycles the pair-color
 *  palette; ``wasCorrect`` records whether the learner had matched this
 *  pair correctly before solving (for an optional subtle marker). */
export interface ResolvedPair {
    left: string;
    right: string;
    slot: number;
    wasCorrect: boolean;
}

/** Staggered per-row animation delay, in ms. Zero under reduced motion
 *  (no class is applied anyway). */
function rowDelay(index: number): string {
    return `${index * 70}ms`;
}

/** The animation utility for a tile in ``effect``, or "" under reduced
 *  motion (the tile then renders directly at its final state). */
function tileAnimation(
    effect: MatchingResolveEffect,
    reduceMotion: boolean,
): string {
    if (reduceMotion) return "";
    switch (effect) {
        case "slide":
            return "animate-[matching-resolve-slide_300ms_ease-out_both]";
        case "stack":
            return "animate-[matching-resolve-stack_300ms_ease-out_both]";
        case "color":
            return "animate-[matching-resolve-fade_200ms_ease-out_both]";
        case "connect":
            return "animate-[matching-resolve-fade_200ms_ease-out_both]";
    }
}

/** A single resolved pair shown as one full-width row (stack effect). */
function StackRow({
    pair,
    index,
    effect,
    reduceMotion,
}: {
    pair: ResolvedPair;
    index: number;
    effect: MatchingResolveEffect;
    reduceMotion: boolean;
}) {
    return (
        <li
            className={cn(
                "flex items-center gap-2 rounded-sm border-2 px-3 py-2 text-[0.9375rem]",
                tileAnimation(effect, reduceMotion),
            )}
            style={
                {
                    "--matching-pair-color": matchingPairColorVar(pair.slot),
                    borderColor: "var(--matching-pair-color)",
                    background:
                        "color-mix(in srgb, var(--matching-pair-color) 14%, var(--bg-surface))",
                    animationDelay: rowDelay(index),
                } as CSSProperties
            }
            data-testid={`matching-resolved-row-${index}`}
        >
            <span className="min-w-0 flex-1 font-medium">
                <InlineMarkdown>{pair.left}</InlineMarkdown>
            </span>
            <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 flex-1 text-right">
                <InlineMarkdown>{pair.right}</InlineMarkdown>
            </span>
        </li>
    );
}

/** One side of a two-column resolved pair (slide / color / connect). */
function ColumnTile({
    label,
    slot,
    side,
    index,
    effect,
    reduceMotion,
    tinted,
}: {
    label: string;
    slot: number;
    side: "a" | "b";
    index: number;
    effect: MatchingResolveEffect;
    reduceMotion: boolean;
    tinted: boolean;
}) {
    const sideBg =
        side === "a" ? "var(--matching-side-a-bg)" : "var(--matching-side-b-bg)";
    const sideFg =
        side === "a" ? "var(--matching-side-a-fg)" : "var(--matching-side-b-fg)";
    return (
        <li
            className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-sm border-2 px-3 py-2 text-[0.9375rem]",
                tileAnimation(effect, reduceMotion),
            )}
            style={
                {
                    "--matching-pair-color": matchingPairColorVar(slot),
                    borderColor: "var(--matching-pair-color)",
                    background: tinted
                        ? "color-mix(in srgb, var(--matching-pair-color) 16%, var(--bg-surface))"
                        : sideBg,
                    color: tinted ? "var(--fg-primary)" : sideFg,
                    animationDelay: rowDelay(index),
                } as CSSProperties
            }
            data-testid={`matching-resolved-${side}-${index}`}
        >
            <span
                aria-hidden="true"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--matching-pair-color)] bg-[var(--bg-surface)] text-[0.625rem] font-bold text-[var(--fg-primary)]"
            >
                {slot + 1}
            </span>
            <span className="min-w-0 flex-1">
                <InlineMarkdown>{label}</InlineMarkdown>
            </span>
        </li>
    );
}

/** SVG overlay drawing one connector line per pair (connect effect).
 *  Lines are placed by row index over an equal-height grid, so they
 *  visually link each left tile to its right partner. */
function ConnectorOverlay({
    count,
    reduceMotion,
}: {
    count: number;
    reduceMotion: boolean;
}) {
    if (count === 0) return null;
    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
            data-testid="matching-resolve-connectors"
        >
            {Array.from({length: count}, (_, i) => {
                const y = ((i + 0.5) / count) * 100;
                return (
                    <line
                        key={i}
                        x1="0"
                        y1={y}
                        x2="100"
                        y2={y}
                        stroke={matchingPairColorVar(i)}
                        strokeWidth="2"
                        strokeLinecap="round"
                        pathLength={100}
                        className={cn(
                            "[stroke-dasharray:100]",
                            reduceMotion
                                ? "[stroke-dashoffset:0]"
                                : "[stroke-dashoffset:100] animate-[matching-resolve-line_400ms_ease-out_forwards]",
                        )}
                        style={{animationDelay: rowDelay(i)}}
                        data-testid={`matching-connector-line-${i}`}
                    />
                );
            })}
        </svg>
    );
}

export interface MatchingResolutionProps {
    pairs: ResolvedPair[];
    effect: MatchingResolveEffect;
    reduceMotion: boolean;
    correctCount: number;
    totalCount: number;
    leftLabel: string;
    rightLabel: string;
    /** #977 — play the reveal animation. False when the learner toggles
     *  BACK to the solution view (it already animated once): the end
     *  result shows immediately without re-running the effect. Defaults
     *  to true so direct callers (and the Review/AdaptiveLesson paths)
     *  keep the original behaviour. */
    animate?: boolean;
}

/**
 * Render the revealed correct pairs with the configured effect.
 *
 * @param props - See {@link MatchingResolutionProps}.
 */
export default function MatchingResolution({
    pairs,
    effect,
    reduceMotion,
    correctCount,
    totalCount,
    leftLabel,
    rightLabel,
    animate = true,
}: MatchingResolutionProps) {
    const {t} = useI18n();
    // Suppress every animation utility when the caller disabled animation
    // (re-toggle) OR the user prefers reduced motion — both render the
    // tiles at their final state immediately.
    const noMotion = reduceMotion || !animate;
    const announcement = t(
        "lesson.exercise.matching.resolve_announce",
        "Solution shown. {correct} of {total} pairs were correct.",
    )
        .replace("{correct}", String(correctCount))
        .replace("{total}", String(totalCount));

    const liveRegion = (
        <span
            className="sr-only"
            role="status"
            aria-live="polite"
            data-testid="matching-resolve-status"
        >
            {announcement}
        </span>
    );

    if (effect === "stack") {
        return (
            <div data-testid="matching-resolution" data-effect="stack">
                {liveRegion}
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {pairs.map((pair, i) => (
                        <StackRow
                            key={i}
                            pair={pair}
                            index={i}
                            effect={effect}
                            reduceMotion={noMotion}
                        />
                    ))}
                </ul>
            </div>
        );
    }

    // slide / color / connect share the aligned two-column layout. Color
    // tints both tiles of a pair; connect overlays the SVG connectors.
    const tinted = effect === "color";
    return (
        <div data-testid="matching-resolution" data-effect={effect}>
            {liveRegion}
            <div className="relative grid grid-cols-2 gap-3">
                <ul
                    className="m-0 grid list-none grid-cols-1 [grid-auto-rows:1fr] gap-2 p-0"
                    aria-label={leftLabel}
                >
                    {pairs.map((pair, i) => (
                        <ColumnTile
                            key={i}
                            label={pair.left}
                            slot={pair.slot}
                            side="a"
                            index={i}
                            effect={effect}
                            reduceMotion={noMotion}
                            tinted={tinted}
                        />
                    ))}
                </ul>
                <ul
                    className="m-0 grid list-none grid-cols-1 [grid-auto-rows:1fr] gap-2 p-0"
                    aria-label={rightLabel}
                >
                    {pairs.map((pair, i) => (
                        <ColumnTile
                            key={i}
                            label={pair.right}
                            slot={pair.slot}
                            side="b"
                            index={i}
                            effect={effect}
                            reduceMotion={noMotion}
                            tinted={tinted}
                        />
                    ))}
                </ul>
                {effect === "connect" && (
                    <ConnectorOverlay
                        count={pairs.length}
                        reduceMotion={noMotion}
                    />
                )}
            </div>
        </div>
    );
}
