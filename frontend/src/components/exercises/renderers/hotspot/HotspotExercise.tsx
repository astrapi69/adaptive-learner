/**
 * HotspotExercise (#3110) — renderer for the adopted extension type
 * ``ext:al-hotspot``: an image with clickable zones, tap the right spot.
 *
 * Reuses the shared building blocks rather than reinventing them:
 *   - {@link useAsset} resolves an ``assets/`` image path to a cached blob
 *     URL (the same lookup ``ImageDescriptionExercise`` / ``PictureChoiceExercise``
 *     use); an embedded ``data:`` URI is self-contained and bypasses it.
 *   - {@link hitTestHotspotZones} — the pure percentage-coordinate hit-test
 *     already unit-tested in isolation; the click handler here only
 *     converts a DOM click into an ``(x, y)`` percentage pair.
 *
 * "Select, then check" (mirrors ``PictureChoiceExercise``): a click selects
 * a zone (or clears the selection on a miss); Check grades it. The correct
 * zone is never revealed before the answer — the SVG overlay's zones carry
 * no visible fill until ``submitted``.
 *
 * Result contract: ``onComplete({correct, total, attempts, raw_answer})``
 * with ``total`` always 1 and ``raw_answer.kind === "al_hotspot"``.
 */

import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../../hooks/lesson/modes/useLessonMode";
import {useAsset} from "../../../../hooks/ui/useAsset";
import {useControlledExercise} from "../../../../lib/exercises/useControlledExercise";
import {
    asHotspotPayload,
    hitTestHotspotZones,
    pointToPercent,
    HOTSPOT_EXT_TYPE,
    type HotspotZone,
} from "../../../../lib/exercises/payload/hotspot";
import {isRemoteImageUrl} from "../../../../lib/exercises/payload/image-description";
import {deriveHotspotAttempt} from "../../../../lib/srs/element-attempt";
import ExercisePromptRow from "../../shell/ExercisePromptRow";
import ExerciseHint from "../../feedback/ExerciseHint";
import ExerciseFooter from "../../shell/ExerciseFooter";
import AnswerCelebration from "../../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../../feedback/ExerciseSuccessAdvance";
import type {ContentLessonExercise} from "../../../../storage/types";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../../shell/exercise-control";

export {HOTSPOT_EXT_TYPE, pointToPercent};

export interface HotspotExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Content source slug ("owner/name") — used to resolve an ``assets/``
     *  image path via {@link useAsset}. Empty on review/adaptive routes (an
     *  embedded data URI still renders). */
    source?: string;
    onComplete: (result: ExerciseScored) => void;
}

const I18N_PREFIX = "lesson.exercise.al_hotspot";

function _normalizeAssetPath(raw: string): string {
    return raw.startsWith("assets/") ? raw.slice("assets/".length) : raw;
}

/** Resolve the stimulus image src: a ``data:`` URI is self-contained and
 *  rendered directly; an ``assets/`` path is resolved via {@link useAsset};
 *  a remote URL is never rendered (offline-first) — mirrors
 *  ``ImageDescriptionExercise``'s ``ImageStimulus`` resolution chain.
 *  Extracted into its own hook so the branching lives here, not in the
 *  main component (keeps ``HotspotExercise``'s cyclomatic complexity flat). */
function useHotspotImageSrc(
    src: string,
    source: string,
    setId: string,
): string | null {
    const isDataUri = src.trim().startsWith("data:");
    const isRemote = isRemoteImageUrl(src);
    const normalized = _normalizeAssetPath(src);
    const assetEnabled = Boolean(!isDataUri && !isRemote && source && setId && normalized);
    const asset = useAsset(
        assetEnabled ? source : null,
        assetEnabled ? setId : null,
        assetEnabled ? normalized : null,
    );
    if (isDataUri) return src;
    if (isRemote) return null;
    return asset.url;
}

/** The image + SVG zone overlay. Split out (mirrors ``ZoneShape``) so the
 *  main component's JSX conditionals + ``.map`` don't add to its own
 *  cyclomatic complexity. */
function HotspotStimulus({
    imageSrc,
    zones,
    submitted,
    selectedZone,
    correctZoneIndex,
    t,
    onOverlayClick,
}: {
    imageSrc: string | null;
    zones: readonly HotspotZone[];
    submitted: boolean;
    selectedZone: number | null;
    correctZoneIndex: number;
    t: (key: string, fallback?: string) => string;
    onOverlayClick: (event: React.MouseEvent<SVGSVGElement>) => void;
}) {
    return (
        <div className="relative w-full max-w-xl" data-testid="hotspot-image-wrap">
            {imageSrc && (
                <img
                    src={imageSrc}
                    alt={t(`${I18N_PREFIX}.image_alt`, "Click the correct spot")}
                    loading="lazy"
                    className="w-full rounded-md border border-border object-contain"
                    data-testid="hotspot-image"
                />
            )}
            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full cursor-crosshair"
                onClick={onOverlayClick}
                data-testid="hotspot-overlay"
                role="img"
                aria-label={t(`${I18N_PREFIX}.overlay_aria`, "Clickable zones")}
            >
                {zones.map((zone, index) => (
                    <ZoneShape
                        key={index}
                        zone={zone}
                        index={index}
                        submitted={submitted}
                        isSelected={selectedZone === index}
                        isCorrectZone={index === correctZoneIndex}
                    />
                ))}
            </svg>
        </div>
    );
}

/** One SVG shape per zone — invisible fill (a wide, transparent hit target)
 *  until ``submitted``, when the correct zone highlights green and a wrong
 *  selection highlights red. Never reveals the answer beforehand. */
function ZoneShape({
    zone,
    index,
    submitted,
    isSelected,
    isCorrectZone,
}: {
    zone: HotspotZone;
    index: number;
    submitted: boolean;
    isSelected: boolean;
    isCorrectZone: boolean;
}) {
    const revealClass = submitted
        ? isCorrectZone
            ? "fill-[color-mix(in_srgb,var(--exercise-correct)_35%,transparent)] stroke-[var(--exercise-correct)]"
            : isSelected
              ? "fill-[color-mix(in_srgb,var(--exercise-wrong)_35%,transparent)] stroke-[var(--exercise-wrong)]"
              : "fill-transparent stroke-transparent"
        : isSelected
          ? "fill-[color-mix(in_srgb,var(--accent)_25%,transparent)] stroke-[var(--accent)]"
          : "fill-transparent stroke-transparent";
    const common = {
        className: `${revealClass} stroke-2`,
        "data-testid": `hotspot-zone-${index}`,
        "data-selected": isSelected,
    };
    if (zone.shape === "rect") {
        const {x, y, width, height} = zone.coords;
        return <rect x={x} y={y} width={width} height={height} {...common} />;
    }
    const {cx, cy, radius} = zone.coords;
    return <circle cx={cx} cy={cy} r={radius} {...common} />;
}

function HotspotExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        source = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        onAdvance,
        advanceLabel,
    }: HotspotExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const payload = useMemo(() => asHotspotPayload(exercise), [exercise]);
    const zones = payload?.zones ?? [];
    const src = payload?.src ?? "";
    const imageSrc = useHotspotImageSrc(src, source, setId);

    const correctZoneIndex = zones.findIndex((zone) => zone.is_correct === "true");

    const reviewedHotspot = reviewed?.kind === "al_hotspot" ? reviewed : null;
    const [selectedZone, setSelectedZone] = useState<number | null>(
        reviewedHotspot ? reviewedHotspot.selected_zone : null,
    );

    const reviewedResult = reviewedHotspot
        ? {correct: reviewedHotspot.selected_zone === correctZoneIndex ? 1 : 0, total: 1}
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: selectedZone !== null,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const isCorrect = selectedZone === correctZoneIndex;
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveHotspotAttempt(
                        exercise,
                        {setId, lessonId},
                        correctZoneIndex,
                        selectedZone ?? -1,
                        isCorrect,
                    ),
                ],
                raw_answer: {kind: "al_hotspot", selected_zone: selectedZone ?? -1},
            };
        },
        resetAnswer: () => setSelectedZone(null),
    });

    if (!payload) {
        return (
            <div data-testid="hotspot-empty">
                {t(`${I18N_PREFIX}.empty`, "This hotspot exercise has no image or zones.")}
            </div>
        );
    }

    function handleOverlayClick(event: React.MouseEvent<SVGSVGElement>) {
        if (submitted) return;
        const point = pointToPercent(
            event.currentTarget.getBoundingClientRect(),
            event.clientX,
            event.clientY,
        );
        setSelectedZone(point ? hitTestHotspotZones(zones, point.x, point.y) : null);
    }

    const isCorrect = result !== null && result.correct > 0;

    return (
        <section className="flex flex-col gap-3" data-testid="hotspot-exercise">
            <ExercisePromptRow prompt={exercise.prompt ?? ""} testId="hotspot-prompt" />

            <ExerciseHint exercise={exercise} submitted={submitted} testId="hotspot-hint-button" />

            <HotspotStimulus
                imageSrc={imageSrc}
                zones={zones}
                submitted={submitted}
                selectedZone={selectedZone}
                correctZoneIndex={correctZoneIndex}
                t={t}
                onOverlayClick={handleOverlayClick}
            />

            <HotspotResult
                submitted={submitted}
                isCorrect={isCorrect}
                showAnswerToggle={showAnswerToggle}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
                controlled={controlled}
                canCheck={selectedZone !== null}
                onCheck={submit}
                onRetry={reset}
            />
        </section>
    );
}

/** Post-check verdict + the shared celebration + check/retry footer. Split
 *  out to keep the renderer's complexity flat (mirrors OrderingResult). */
function HotspotResult({
    submitted,
    isCorrect,
    showAnswerToggle,
    onAdvance,
    advanceLabel,
    controlled,
    canCheck,
    onCheck,
    onRetry,
}: {
    submitted: boolean;
    isCorrect: boolean;
    showAnswerToggle: boolean;
    onAdvance?: () => void;
    advanceLabel?: string;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
}) {
    const {t} = useI18n();
    return (
        <>
            {submitted && (
                <p
                    className={`answer-feedback m-0 font-medium ${
                        isCorrect ? "is-correct text-[var(--success)]" : "is-wrong text-[var(--danger)]"
                    }`}
                    data-testid="hotspot-result"
                    data-result={isCorrect ? "correct" : "wrong"}
                >
                    {isCorrect
                        ? t(`${I18N_PREFIX}.result_correct`, "Correct!")
                        : t(`${I18N_PREFIX}.result_wrong`, "Not quite.")}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {submitted && <AnswerCelebration isCorrect={isCorrect} />}
                {submitted && isCorrect && showAnswerToggle && onAdvance && (
                    <ExerciseSuccessAdvance
                        onAdvance={onAdvance}
                        label={advanceLabel}
                        testIdPrefix="hotspot"
                    />
                )}
                <ExerciseFooter
                    testidPrefix="hotspot"
                    controlled={controlled}
                    submitted={submitted}
                    canCheck={canCheck}
                    onCheck={onCheck}
                    onRetry={onRetry}
                    checkLabel={t(`${I18N_PREFIX}.submit`, "Check answer")}
                    retryLabel={t(`${I18N_PREFIX}.retry`, "Try again")}
                />
            </div>
        </>
    );
}

export default forwardRef(HotspotExercise);
