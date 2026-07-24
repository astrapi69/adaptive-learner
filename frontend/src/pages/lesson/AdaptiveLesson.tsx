/**
 * /adaptive-lesson/:setId — adaptive lesson session
 * (Phase 53G / v1.36.0 / EXP-013 / F-115, F-116).
 *
 * Mirrors the Review page's layout but the synthesis route
 * runs the full adaptive pipeline (53A → 53B → 53C → 53D)
 * via :hook:`useAdaptiveLesson`.
 *
 * Transparency (F-115): before the first step the user sees
 * the focus tags + a count of active errors driving the
 * generation. No black box — the user always knows what the
 * lesson targets and why.
 *
 * Improvement indicator (F-116): on the summary screen the
 * page compares mastered-element counts before / after the
 * session and surfaces the delta ("+2 mastered this
 * session"). Computed by the hook's ``finalize`` callback.
 *
 * Adaptive sessions are ephemeral: no LessonProgress row,
 * but ElementError rows DO get updated on every attempt via
 * the same recordBulk path the main viewer uses (closing
 * the error → analysis → generation → new errors loop).
 *
 * Dexie-mode-friendly: every storage call routes through
 * ``getStorage()``. The 53H smoke gate pins this.
 */

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Download,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
  type NavigateFunction,
} from "react-router-dom";

import SaveAdaptiveLessonButton from "../../components/content/lessons/SaveAdaptiveLessonButton";
import {
  ExerciseDispatcher,
  SUPPORTED_EXERCISE_TYPES,
} from "../../components/exercises";
import type { ExerciseHandle } from "../../components/exercises";
import { Button } from "@/components/ui/button";
import ProgressBar from "../../shared/data-display/ProgressBar";
import { useI18n } from "../../hooks/ui/useI18n";
import { useAdaptiveLesson } from "../../hooks/lesson/modes/useAdaptiveLesson";
import type { ErrorTag } from "../../lib/adaptive/error-classifier";
import type { AdaptiveTransparency } from "../../hooks/lesson/modes/useAdaptiveLesson";
import type {
  ContentLesson,
  ContentLessonStep,
  ElementAttempt,
} from "../../storage/types";
import type { ExerciseScored } from "../../components/exercises";

type Translate = (key: string, fallback?: string) => string;

interface UrlParams {
  setId: string;
  [key: string]: string | undefined;
}

const TAG_I18N_KEYS: Record<ErrorTag, [string, string]> = {
  article_gender: [
    "dashboard.focus_areas.tag.article_gender",
    "Article gender",
  ],
  spelling_accent: [
    "dashboard.focus_areas.tag.spelling_accent",
    "Spelling & accents",
  ],
  verb_conjugation: [
    "dashboard.focus_areas.tag.verb_conjugation",
    "Verb conjugation",
  ],
  word_order: ["dashboard.focus_areas.tag.word_order", "Word order"],
};

export default function AdaptiveLessonPage() {
  const params = useParams<UrlParams>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const setId = params.setId ?? "";
  // #1012 — optional ?lesson= scope: train only this lesson's failed cards.
  const lessonId = searchParams.get("lesson") ?? undefined;

  const {
    status,
    lesson,
    transparency,
    currentStepIndex,
    error,
    goNext,
    goPrev,
    recordStepAttempts,
    sessionScoreCorrect,
    sessionScoreTotal,
    masteredDelta,
    finalize,
  } = useAdaptiveLesson({
    setId,
    lessonId,
    title: t("adaptive.session_title", "Adaptive lesson"),
  });

  const totalSteps = lesson?.steps.length ?? 0;
  const isSummary = totalSteps > 0 && currentStepIndex >= totalSteps;

  // BUG P1 — single two-phase button (Check -> Weiter). The exercise
  // renders in controlled mode (its internal "Prüfen"/retry buttons are
  // hidden) and the page drives one shared button via the ref, so the
  // exercise's submit and the page's "Weiter" are never both visible.
  const exerciseRef = useRef<ExerciseHandle>(null);
  const [checked, setChecked] = useState(false);
  const [answerable, setAnswerable] = useState(false);
  // Reset the two-phase button whenever the step changes.
  useEffect(() => {
    setChecked(false);
    setAnswerable(false);
  }, [currentStepIndex]);

  // Trigger finalize the first time the user lands on the
  // summary so the mastery delta gets computed.
  const [finalised, setFinalised] = useState(false);
  useEffect(() => {
    if (isSummary && !finalised) {
      setFinalised(true);
      void finalize();
    }
  }, [isSummary, finalised, finalize]);

  const statusScreen = renderAdaptiveLessonStatus(setId, status, navigate, t);
  if (statusScreen) return statusScreen;

  if (status === "error" || lesson === null) {
    return (
      <main
        id="main"
        className="lesson-page"
        data-testid="adaptive-lesson-error"
      >
        <p>
          {t(
            "adaptive.error.load_failed",
            "Could not generate adaptive lesson.",
          )}
          {error ? ` (${error})` : ""}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {t("adaptive.back_to_dashboard", "Back to Dashboard")}
        </Button>
      </main>
    );
  }

  const step = isSummary ? null : lesson.steps[currentStepIndex];
  const isExerciseStep =
    step != null &&
    step.type === "exercise" &&
    step.exercise != null &&
    SUPPORTED_EXERCISE_TYPES.has(step.exercise.type);
  const progressPct =
    totalSteps === 0 ? 100 : Math.round((currentStepIndex / totalSteps) * 100);

  return (
    <main
      id="main"
      className="lesson-page"
      data-testid="adaptive-lesson-page"
    >
      <header className="lesson-header">
        <button
          type="button"
          className="lesson-back-btn"
          onClick={() => navigate("/dashboard")}
          data-testid="adaptive-lesson-back-btn"
          aria-label={t("adaptive.back_to_dashboard", "Back to Dashboard")}
        >
          <BookOpen size={16} aria-hidden="true" />
          {t("adaptive.back_to_dashboard", "Back to Dashboard")}
        </button>
        <h1>{lesson.title}</h1>
        {transparency && (
          <AdaptiveTransparencyDisplay
            transparency={transparency}
            tagLabels={TAG_I18N_KEYS}
            t={t}
          />
        )}
      </header>

      <ProgressBar
        valueNow={progressPct}
        ariaLabel={t("lesson.progress.aria_label", "Lesson progress")}
        className="lesson-progress-bar"
        fillClassName="lesson-progress-fill"
        labelClassName="lesson-progress-label"
        testId="adaptive-lesson-progress-bar"
      >
        {isSummary
          ? t("lesson.progress.summary", "Summary")
          : t("lesson.progress.step_of", "Step {current} of {total}")
              .replace("{current}", String(currentStepIndex + 1))
              .replace("{total}", String(totalSteps))}
      </ProgressBar>

      {isSummary ? (
        <>
          <AdaptiveSummary
            correct={sessionScoreCorrect}
            total={sessionScoreTotal}
            masteredDelta={masteredDelta}
            onExit={() => navigate("/dashboard")}
          />
          {/* Phase 59F — save this adaptive lesson for replay. */}
          <div className="adaptive-save-row" data-testid="adaptive-save-row">
            <SaveAdaptiveLessonButton lesson={lesson} />
          </div>
        </>
      ) : (
        <AdaptiveLessonExercise
          step={step!}
          setId={setId}
          cards={lesson.cards}
          exerciseRef={exerciseRef}
          onInteraction={setAnswerable}
          onChecked={() => setChecked(true)}
          recordStepAttempts={recordStepAttempts}
        />
      )}

      <AdaptiveLessonNav
        isSummary={isSummary}
        isExerciseStep={isExerciseStep}
        checked={checked}
        answerable={answerable}
        isFirstStep={currentStepIndex === 0}
        isLastStep={currentStepIndex + 1 === totalSteps}
        onPrev={goPrev}
        onNext={goNext}
        onCheck={() => exerciseRef.current?.submit()}
        t={t}
      />
    </main>
  );
}

/** Render the non-playing status screen for an adaptive lesson
 *  (missing param / loading / empty / not-cached), or ``null`` once a
 *  playable lesson is ready. The ``error`` / ``lesson === null`` case
 *  stays inline in the page so TypeScript narrows ``lesson`` for the
 *  main render. */
function renderAdaptiveLessonStatus(
  setId: string,
  status: string,
  navigate: NavigateFunction,
  t: Translate,
): ReactElement | null {
  if (!setId) {
    return (
      <main
        id="main"
        className="lesson-page"
        data-testid="adaptive-lesson-missing-params"
      >
        <h1>{t("adaptive.page_title", "Adaptive Lesson")}</h1>
        <p>{t("adaptive.error.missing_params", "No content set selected.")}</p>
      </main>
    );
  }
  if (status === "loading") {
    return (
      <main
        id="main"
        className="lesson-page"
        data-testid="adaptive-lesson-loading"
      >
        <p>{t("adaptive.loading", "Analyzing your errors…")}</p>
      </main>
    );
  }
  if (status === "empty") {
    return (
      <main
        id="main"
        className="lesson-page"
        data-testid="adaptive-lesson-empty"
      >
        <header className="lesson-header">
          <h1>{t("adaptive.page_title", "Adaptive Lesson")}</h1>
        </header>
        <p className="lesson-not-cached-body">
          {t(
            "adaptive.empty_body",
            "Nothing to adapt yet - practice a lesson to build up data.",
          )}
        </p>
        <p>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard")}
            data-testid="adaptive-lesson-back-to-dashboard"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {t("adaptive.back_to_dashboard", "Back to Dashboard")}
          </Button>
        </p>
      </main>
    );
  }
  if (status === "not-cached") {
    return (
      <main
        id="main"
        className="lesson-page"
        data-testid="adaptive-lesson-not-cached"
      >
        <header className="lesson-header">
          <h1>{t("adaptive.page_title", "Adaptive Lesson")}</h1>
        </header>
        <p className="lesson-not-cached-body">
          {t(
            "adaptive.not_cached_body",
            "This set isn't downloaded yet. Open the content browser to download it first.",
          )}
        </p>
        <p>
          <Button
            type="button"
            onClick={() => navigate("/content?tab=my")}
            data-testid="adaptive-lesson-goto-content"
          >
            <Download size={14} aria-hidden="true" />
            {t("lesson.action.open_browser", "Open content browser")}
          </Button>
        </p>
      </main>
    );
  }
  return null;
}

interface AdaptiveLessonExerciseProps {
  step: ContentLessonStep;
  setId: string;
  cards: ContentLesson["cards"];
  exerciseRef: Ref<ExerciseHandle>;
  onInteraction: (answerable: boolean) => void;
  onChecked: () => void;
  recordStepAttempts: (attempts: readonly ElementAttempt[]) => Promise<void>;
}

/** The active exercise step: the controlled ExerciseDispatcher wrapped
 *  in the lesson-step article. Flips to the "Weiter" phase + records
 *  the per-element attempts on completion. */
function AdaptiveLessonExercise({
  step,
  setId,
  cards,
  exerciseRef,
  onInteraction,
  onChecked,
  recordStepAttempts,
}: AdaptiveLessonExerciseProps) {
  return (
    <article
      className="lesson-step"
      data-testid={`adaptive-step-${step.id}`}
      data-step-type={step.type}
    >
      <ExerciseDispatcher
        key={step.id}
        ref={exerciseRef}
        controlled
        onInteraction={onInteraction}
        step={step}
        setId={setId}
        lessonId={_extractLessonIdFromStep(step.id)}
        cards={cards}
        onComplete={async (scored: ExerciseScored) => {
          // Flip to the "Weiter" phase the moment the answer is
          // graded, then record the per-element attempts.
          onChecked();
          await recordStepAttempts(scored.attempts);
        }}
      />
    </article>
  );
}

interface AdaptiveLessonNavProps {
  isSummary: boolean;
  isExerciseStep: boolean;
  checked: boolean;
  answerable: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCheck: () => void;
  t: Translate;
}

/** Step navigation footer: Previous + the single two-phase
 *  Check/Next button (hidden on the summary screen). */
function AdaptiveLessonNav({
  isSummary,
  isExerciseStep,
  checked,
  answerable,
  isFirstStep,
  isLastStep,
  onPrev,
  onNext,
  onCheck,
  t,
}: AdaptiveLessonNavProps) {
  return (
    <nav
      // #1419 — same sticky-footer pattern as LessonFooterNav (#43/#1410);
      // the old .lesson-nav* CSS was removed in the Phase B migration.
      className="sticky bottom-0 z-10 mt-4 flex flex-row items-center gap-2 border-t border-border bg-bg-primary pt-3 pb-safe"
      aria-label={t("lesson.nav.aria_label", "Step navigation")}
    >
      <Button
        type="button"
        variant="outline"
        className="min-w-[44px]"
        onClick={onPrev}
        disabled={isFirstStep}
        data-testid="adaptive-lesson-prev"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {t("lesson.action.prev", "Previous")}
      </Button>
      {!isSummary &&
        (isExerciseStep && !checked ? (
          <Button
            type="button"
            className="ml-auto"
            onClick={onCheck}
            disabled={!answerable}
            title={
              !answerable
                ? t(
                    "lesson.button.check_disabled_hint",
                    "Answer the exercise first",
                  )
                : undefined
            }
            data-testid="adaptive-lesson-check"
          >
            {t("lesson.button.check", "Check")}
          </Button>
        ) : (
          <Button
            type="button"
            className="ml-auto"
            onClick={onNext}
            data-testid="adaptive-lesson-next"
          >
            {isLastStep
              ? t("lesson.action.finish", "Finish lesson")
              : t("lesson.action.next", "Next")}
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        ))}
    </nav>
  );
}

/** Parse the lesson_id out of a synthesised exercise-step id.
 *  Adaptive steps are emitted as
 *  ``"adaptive-step-{index}-{element_key}-{exercise_id}"`` by
 *  the generator. The exercise_id + element_key are
 *  slug-safe so the last two hyphen segments are unambiguous.
 *  When the synthesised step originated from a generated
 *  cloze, its exercise.id is ``"gen-cloze-..."`` and the
 *  embedded lesson_id is the source error's lesson — we use
 *  the heuristic that the lesson is whatever the source
 *  exercise referenced. Falls back to ``""`` when parsing
 *  fails; the attempt deriver tolerates an empty lesson_id by
 *  stamping the recorded ElementError with the value already
 *  present on the underlying exercise card refs. */
function _extractLessonIdFromStep(stepId: string): string {
  // Theory steps emit "adaptive-theory-{cluster_key}-{...}"
  // and don't need lesson_id resolution.
  if (stepId.startsWith("adaptive-theory-")) return "";
  if (!stepId.startsWith("adaptive-step-")) return "";
  // We deliberately don't try to recover lesson_id from the
  // step id; the generator embeds the source lesson on the
  // candidate, but that doesn't survive into the rendered
  // step. The element-attempt deriver in
  // ExerciseDispatcher reads card metadata at submit time
  // and stamps the right lesson_id from there.
  return "";
}

interface AdaptiveTransparencyDisplayProps {
  transparency: AdaptiveTransparency;
  tagLabels: Record<ErrorTag, [string, string]>;
  t: (key: string, fallback?: string) => string;
}

function AdaptiveTransparencyDisplay({
  transparency,
  tagLabels,
  t,
}: AdaptiveTransparencyDisplayProps) {
  const tagText =
    transparency.tags.length > 0
      ? transparency.tags.map((tag) => t(...tagLabels[tag])).join(", ")
      : t("adaptive.transparency.tag_none", "your weakest elements");
  const errorsLine = t(
    "adaptive.transparency.errors_line",
    "Based on {n} active error(s)",
  ).replace("{n}", String(transparency.total_errors));
  return (
    <div
      className="lesson-description adaptive-transparency"
      data-testid="adaptive-transparency"
    >
      <p data-testid="adaptive-transparency-focus">
        <Sparkles size={14} aria-hidden="true" />
        {t(
          "adaptive.transparency.focus_prefix",
          "This lesson focuses on:",
        )}{" "}
        <strong>{tagText}</strong>
      </p>
      <p className="muted" data-testid="adaptive-transparency-errors">
        {errorsLine}
      </p>
    </div>
  );
}

interface AdaptiveSummaryProps {
  correct: number;
  total: number;
  masteredDelta: number | null;
  onExit: () => void;
}

function AdaptiveSummary({
  correct,
  total,
  masteredDelta,
  onExit,
}: AdaptiveSummaryProps) {
  const { t } = useI18n();
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <section
      className="lesson-summary"
      data-testid="adaptive-lesson-summary"
      aria-label={t("adaptive.summary.aria_label", "Adaptive lesson summary")}
    >
      <h2>{t("adaptive.summary.heading", "Adaptive lesson complete")}</h2>
      <ul className="lesson-summary-stats">
        <li>
          <strong>{t("adaptive.summary.score", "Score")}:</strong>{" "}
          <span data-testid="adaptive-summary-score">
            {correct} / {total} ({pct}%)
          </span>
        </li>
      </ul>
      {masteredDelta !== null && masteredDelta > 0 && (
        <p
          className="adaptive-summary-improvement"
          data-testid="adaptive-summary-mastered-delta"
        >
          <TrendingUp size={14} aria-hidden="true" />
          {t(
            "adaptive.summary.mastered_delta",
            "Improvement: +{n} element(s) mastered this session!",
          ).replace("{n}", String(masteredDelta))}
        </p>
      )}
      <p className="review-summary-note">
        {t(
          "adaptive.summary.note",
          "Element scores have been updated. Your next adaptive lesson will target the elements that still need work.",
        )}
      </p>
      <div className="lesson-summary-actions">
        <Button
          type="button"
          onClick={onExit}
          data-testid="adaptive-summary-exit"
        >
          {t("adaptive.back_to_dashboard", "Back to Dashboard")}
        </Button>
      </div>
    </section>
  );
}
