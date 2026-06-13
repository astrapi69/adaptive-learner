/**
 * /lesson/:setSlug/:setId/:filename — lesson viewer
 * (Phase 44 / EXP-002 / 3B — F-102 + F-103).
 *
 * Walks the user through a downloaded lesson step-by-step:
 * theory bodies render via react-markdown (same pipeline the
 * help drawer + Learning-Repo page use), exercise steps land
 * a placeholder for now (commit 4 + 5 add MatchingExercise +
 * PictureChoiceExercise; commit 6 wires them into the
 * dispatch). After the last step, a summary card surfaces the
 * aggregate score + time-spent + a "Mark complete" button.
 *
 * Storage-mode-agnostic: the underlying ``useLesson`` hook
 * routes through ``getStorage().contentLoader.*`` /
 * ``lessonProgress.*`` so the page works in API mode AND
 * Dexie-mode (GitHub Pages). When a user lands here for a set
 * they haven't downloaded yet, the viewer shows a friendly
 * "Open the Set Browser to download" notice instead of
 * crashing with a 404 toast.
 *
 * Mobile-first: prev / next buttons stretch to fill on small
 * viewports so the touch target stays above 44px.
 */

import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Square,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import LessonExitDialog from "../components/lesson/LessonExitDialog";
import LessonResumeDialog from "../components/lesson/LessonResumeDialog";
import TheoryStep from "../components/lesson/TheoryStep";
import ReviewedFallbackPanel from "../components/lesson/ReviewedFallbackPanel";
import LessonSummary from "../components/lesson/LessonSummary";
import { useLessonAutoRead } from "../hooks/useLessonAutoRead";
import {
  ExerciseDispatcher,
  SUPPORTED_EXERCISE_TYPES,
} from "../components/exercises/ExerciseDispatcher";
import type { ExerciseHandle } from "../components/exercises/exercise-control";
import LessonTtsMiniPlayer from "../components/lesson/LessonTtsMiniPlayer";
import { READ_ALOUD_SPEEDS } from "../hooks/useReadAloud";
import { useI18n } from "../hooks/useI18n";
import { useLesson } from "../hooks/useLesson";
import { useLessonFlowControl } from "../hooks/useLessonFlowControl";
import { useLessonNavigation } from "../hooks/useLessonNavigation";
import {
  useLessonEnterKey,
  type LessonEnterNav,
} from "../hooks/useLessonEnterKey";
import { useLessonShortcuts } from "../hooks/useLessonShortcuts";
import {
  captureCelebrationSnapshot,
  celebrateProgressSince,
} from "../lib/feedback/celebration-stats";
import { formatUserAnswer } from "../lib/lesson/result-export";
import { localTodayIso } from "../lib/missions/schedule";
import { celebrateMissions } from "../lib/praise/celebration-bus";
import { rewriteAnchors } from "../lib/lesson-anchors";
import { readLearnerState } from "../lib/learnerState";
import { getStorage } from "../storage";
import type { RawAnswer } from "../storage/types";

interface UrlParams {
  setSlug: string;
  setId: string;
  filename: string;
  [key: string]: string | undefined;
}

export default function LessonPage() {
  const params = useParams<UrlParams>();
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const source = useMemo(
    () => (params.setSlug ?? "").replace(/--/g, "/"),
    [params.setSlug],
  );
  const setId = params.setId ?? "";
  const filename = params.filename ?? "";

  const {
    status,
    lesson,
    progress,
    currentStepIndex,
    error,
    goNext,
    goPrev,
    goToStep,
    goToStepById,
    recordStepResult,
    markCompleted,
    markPaused,
    markAbandoned,
    markResumed,
    markRestarted,
    autosave,
  } = useLesson({ source, setId, lessonFilename: filename });

  // Phase 63 B/C/E lifecycle (exit dialog, resume prompt, auto-pause,
  // 30s autosave) lives in the extracted hook (#354).
  const {
    exitOpen,
    setExitOpen,
    isInProgress,
    showResumePrompt,
    handleResume,
    handleStartOver,
    handlePauseFromDialog,
    handleAbandonFromDialog,
  } = useLessonFlowControl({
    status,
    progress,
    markPaused,
    markAbandoned,
    markResumed,
    markRestarted,
    autosave,
    goToStep,
  });

  // Phase 46B — userId for the elementErrors.recordBulk
  // call inside ExerciseDispatcher's onComplete. Read once
  // on mount; useLesson already reads it for the progress
  // path but doesn't expose it.
  const learnerUserId = useMemo(() => readLearnerState().userId, []);

  // BUG P1 / Problem 1 — two-phase "Prüfen" → "Weiter" button.
  // The active exercise reports whether its answer is checkable
  // (``answerable``) so the shared button can enable; the parent
  // drives evaluation through ``exerciseRef`` on the "Prüfen"
  // click; ``checked`` flips once the answer is graded so the
  // next click advances. All three reset whenever the step
  // changes (so a fresh exercise starts at "Prüfen" disabled).
  const exerciseRef = useRef<ExerciseHandle>(null);
  const [answerable, setAnswerable] = useState(false);
  const [checked, setChecked] = useState(false);
  // Enter-key shortcut (#103). The listener is registered once and
  // reads the latest step state through a ref (the state is computed
  // after the loading guards, below). ``enterLockRef`` blocks a
  // double Check between ``submit()`` and the ``checked`` flip.
  const lessonShortcutsEnabled = useLessonShortcuts();
  const enterStateRef = useRef<LessonEnterNav | null>(null);
  const enterLockRef = useRef(false);
  // BUG P1 / Problem 2 — when a step is ENTERED with a result
  // already stored, it renders locked (reviewed) so the learner
  // cannot re-answer it. ``reviewedRaw`` carries the persisted
  // answer for an exact reconstruction; ``enteredReviewed`` with
  // a null ``reviewedRaw`` is a pre-feature legacy row that gets
  // the compact fallback panel instead.
  const [enteredReviewed, setEnteredReviewed] = useState(false);
  const [reviewedRaw, setReviewedRaw] = useState<RawAnswer | null>(null);
  // Reset the per-step state the instant the step changes.
  // A render-phase reset (the React "adjust state on prop
  // change" pattern) runs BEFORE the freshly-mounted child's
  // ``onInteraction`` effect, so an exercise that is answerable
  // on mount is not clobbered back to disabled — unlike an
  // effect, whose parent-after-child ordering would lose that
  // first signal. ``progress`` updating mid-step (after a check)
  // does NOT re-run this, so the just-graded step keeps its live
  // feedback instead of flipping into the locked view.
  // -1 sentinel so the FIRST render also computes the reviewed
  // state (a step entered directly on a completed step, e.g. a
  // resume / deep-link, renders locked — not just steps reached
  // by in-session navigation).
  const prevStepIndexRef = useRef(-1);
  if (prevStepIndexRef.current !== currentStepIndex) {
    prevStepIndexRef.current = currentStepIndex;
    const steps = lesson?.steps;
    const stored =
      steps && currentStepIndex < steps.length
        ? progress?.step_results?.[steps[currentStepIndex].id]
        : undefined;
    setAnswerable(false);
    setChecked(false);
    setEnteredReviewed(stored != null);
    setReviewedRaw(stored?.raw_answer ?? null);
    enterLockRef.current = false;
  }

  // Scroll-to-top on step change + the #140 theory back-link
  // round-trip live in the extracted hook (#354).
  const {
    precedingTheoryIndex,
    theoryReturnIndex,
    openTheoryFromExercise,
    returnToExercise,
  } = useLessonNavigation({ lesson, currentStepIndex, goToStep });


  // TTS read-aloud — auto-read mode, the "R" shortcut, and continuous
  // theory reading now live in the extracted hook (#404).
  const {
    tts,
    autoRead,
    toggleAutoRead,
    startContinuous,
    isContinuous,
    theoryBlock,
    readTheoryStepAt,
    continuousAvailable,
  } = useLessonAutoRead({ lesson, currentStepIndex, showResumePrompt, goToStep });

  // Keyboard shortcut (#103): Enter drives the two-phase Check / Next
  // button. The listener (shared with the Error-Replay runner via
  // ``useLessonEnterKey``) reads the latest step state through
  // ``enterStateRef`` (updated each render after the loading guards).
  useLessonEnterKey({
    enabled: lessonShortcutsEnabled,
    exerciseRef,
    enterStateRef,
    enterLockRef,
  });
  // Phase 46A — fetch the set's lesson list so the summary
  // screen's "Next lesson" button knows whether there's a
  // successor + what filename to navigate to. One extra
  // storage round-trip on mount; cached by both storages.
  // ``null`` means "no next lesson" (last in set OR list not
  // yet loaded). Failures degrade silently — the button just
  // doesn't render.
  const [nextLessonFilename, setNextLessonFilename] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (!source || !setId || !filename) {
      setNextLessonFilename(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await getStorage().contentLoader.listLessons(
          source,
          setId,
        );
        if (cancelled) return;
        const idx = list.lessons.indexOf(filename);
        if (idx >= 0 && idx < list.lessons.length - 1) {
          setNextLessonFilename(list.lessons[idx + 1]);
        } else {
          setNextLessonFilename(null);
        }
      } catch {
        if (!cancelled) setNextLessonFilename(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, setId, filename]);

  // Phase 51 bugfix — resolve the set's display title so the
  // header can show context above the lesson title
  // ("Set: Français A1 — Beginner" → "Les articles"). Looks up
  // via listSets + filter; degrades silently if the set isn't
  // in the discovered list (header just omits the line).
  const [setTitle, setSetTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!setId) {
      setSetTitle(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await getStorage().contentLoader.listSets();
        if (cancelled) return;
        const match = list.sets.find((s) => s.id === setId);
        setSetTitle(match?.title ?? null);
      } catch {
        if (!cancelled) setSetTitle(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setId]);

  if (!source || !setId || !filename) {
    return (
      <main
        id="main"
        className="page lesson-page flex flex-col min-h-full"
        data-testid="lesson-missing-params"
      >
        <h1>{t("lesson.page_title", "Lesson")}</h1>
        <p>
          {t(
            "lesson.error.missing_params",
            "No lesson selected. Browse content sets to pick one.",
          )}
        </p>
        <Button asChild variant="default">
          <Link to="/content">
            {t("lesson.action.open_browser", "Open content browser")}
          </Link>
        </Button>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main
        id="main"
        className="page lesson-page flex flex-col min-h-full"
        data-testid="lesson-loading"
      >
        <p>{t("lesson.loading", "Loading lesson…")}</p>
      </main>
    );
  }

  if (status === "not-cached") {
    return (
      <main
        id="main"
        className="page lesson-page flex flex-col min-h-full"
        data-testid="lesson-not-cached"
      >
        <header className="lesson-header">
          <h1>{t("lesson.page_title", "Lesson")}</h1>
        </header>
        <p className="lesson-not-cached-body">
          {t(
            "lesson.not_cached_body",
            "This lesson isn't downloaded yet. Open the content browser and download the set first.",
          )}
        </p>
        <p>
          <Button
            type="button"
            onClick={() => navigate("/content")}
            data-testid="lesson-goto-content"
          >
            <Download size={14} aria-hidden="true" />
            {t("lesson.action.open_browser", "Open content browser")}
          </Button>
        </p>
      </main>
    );
  }

  if (status === "error" || lesson === null) {
    return (
      <main
        id="main"
        className="page lesson-page flex flex-col min-h-full"
        data-testid="lesson-error"
      >
        <p>
          {t("lesson.error.load_failed", "Could not load lesson.")}
          {error ? ` (${error})` : ""}
        </p>
        <Button type="button" onClick={() => navigate("/content")}>
          {t("lesson.action.open_browser", "Open content browser")}
        </Button>
      </main>
    );
  }

  const totalSteps = lesson.steps.length;
  const isSummary = currentStepIndex >= totalSteps;
  const step = isSummary ? null : lesson.steps[currentStepIndex];
  // An exercise step gates the two-phase button; theory steps
  // (and any unsupported/placeholder exercise type) keep the
  // plain always-enabled "Next" button so the user is never
  // stuck on a step they can't "check".
  const isExerciseStep =
    step !== null &&
    step.type !== "theory" &&
    step.exercise != null &&
    SUPPORTED_EXERCISE_TYPES.has(step.exercise.type);
  const isLastStep = currentStepIndex + 1 === totalSteps;
  // Keep the Enter-shortcut listener (#103) reading the latest step
  // state without re-subscribing on every render.
  enterStateRef.current = {
    isSummary,
    isExerciseStep,
    checked,
    enteredReviewed,
    answerable,
    goNext,
  };
  const progressPct =
    totalSteps === 0 ? 100 : Math.round((currentStepIndex / totalSteps) * 100);

  return (
    <main
      id="main"
      className="page lesson-page flex flex-col min-h-full"
      data-testid="lesson-page"
    >
      <header className="lesson-header">
        <Button
          type="button"
          variant="ghost"
          className="lesson-back-btn"
          onClick={() => {
            // Phase 63B — only intercept while the
            // lesson is in progress. Completed /
            // abandoned rows behave like before and
            // navigate straight away. Semantically this is
            // PAUSING the lesson (the dialog offers
            // pause/abandon/continue), not just "going back".
            if (isInProgress) {
              setExitOpen(true);
            } else {
              navigate("/content");
            }
          }}
          data-testid="lesson-back-btn"
          aria-label={t("lesson.action.pause", "Pause lesson")}
          title={t("lesson.action.pause", "Pause lesson")}
        >
          <Pause size={16} aria-hidden="true" />
          <span className="hidden md:inline">
            {t("lesson.action.pause", "Pause lesson")}
          </span>
        </Button>
        <LessonExitDialog
          open={exitOpen}
          onContinue={() => setExitOpen(false)}
          onPause={() => void handlePauseFromDialog()}
          onAbandon={() => void handleAbandonFromDialog()}
        />
        {setTitle && (
          <p className="lesson-header-set" data-testid="lesson-header-set">
            <span className="lesson-header-set-label">
              {t("lesson.set_label", "Set")}:
            </span>
            {setTitle}
          </p>
        )}
        <h1>{lesson.title}</h1>
        {lesson.contributed_by && (
          <p className="lesson-credit" data-testid="lesson-credit">
            {t("lesson.contributed_by", "Contributed by {name}").replace(
              "{name}",
              lesson.contributed_by,
            )}
          </p>
        )}
        {lesson.description && (
          <p className="lesson-description">{lesson.description}</p>
        )}
      </header>

      {/* Phase 63C — resume prompt overlays the step view.
                The user must choose before they can interact with
                the lesson content. */}
      <LessonResumeDialog
        open={showResumePrompt}
        lessonTitle={lesson?.title ?? ""}
        onResume={() => void handleResume()}
        onStartOver={() => void handleStartOver()}
      />

      <div
        className="lesson-progress-bar"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("lesson.progress.aria_label", "Lesson progress")}
        data-testid="lesson-progress-bar"
      >
        <div
          className="lesson-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
        <span className="lesson-progress-label">
          {isSummary
            ? t("lesson.progress.summary", "Summary")
            : t("lesson.progress.step_of", "Step {current} of {total}")
                .replace("{current}", String(currentStepIndex + 1))
                .replace("{total}", String(totalSteps))}
        </span>
      </div>

      {!isSummary && tts.enabled && (
        <div className="lesson-tts-controls" data-testid="lesson-tts-controls">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`lesson-tts-autoread${autoRead ? " is-on" : ""}`}
            data-testid="lesson-tts-autoread"
            aria-pressed={autoRead}
            onClick={toggleAutoRead}
          >
            <Volume2 size={14} aria-hidden="true" />
            {t("lesson.tts.auto_read", "Auto read-aloud")}
          </Button>

          {/* Continuous theory reading (C7) — reads the whole
                        run of consecutive theory steps, auto-advancing
                        the viewer; stops at the next exercise. */}
          {continuousAvailable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`lesson-tts-autoread${isContinuous ? " is-on" : ""}`}
              data-testid="lesson-tts-readall"
              aria-pressed={isContinuous}
              onClick={() => (isContinuous ? tts.stop() : startContinuous())}
            >
              {isContinuous ? (
                <Square size={14} aria-hidden="true" />
              ) : (
                <Volume2 size={14} aria-hidden="true" />
              )}
              {isContinuous
                ? t("lesson.tts.stop", "Stop")
                : t("lesson.tts.read_all", "Read all")}
            </Button>
          )}

          {/* Inline speed control — only while a stream is
                        playing (C4). Changing it restarts the current
                        read at the new rate. */}
          {tts.speaking && (
            <div
              className="lesson-tts-speed"
              data-testid="lesson-tts-speed"
              role="group"
              aria-label={t("lesson.tts.speed", "Speed")}
            >
              <span className="lesson-tts-speed-label">
                {t("lesson.tts.speed", "Speed")}
              </span>
              {READ_ALOUD_SPEEDS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`lesson-tts-speed-btn${
                    tts.speed === s ? " is-active" : ""
                  }`}
                  data-testid={`lesson-tts-speed-${s}`}
                  aria-pressed={tts.speed === s}
                  onClick={() => tts.setSpeed(s)}
                >
                  {s}x
                </Button>
              ))}
            </div>
          )}

          {/* No-voice warning — the requested language has no
                        installed voice; playback falls back to the
                        engine default. */}
          {!tts.voiceAvailable && (
            <span
              className="lesson-tts-novoice"
              data-testid="lesson-tts-novoice"
              role="status"
            >
              {t(
                "lesson.tts.no_voice",
                "No voice available for {language}",
              ).replace("{language}", lesson.target_language ?? "")}
            </span>
          )}
        </div>
      )}

      {isSummary ? (
        <LessonSummary
          lesson={lesson}
          progress={progress}
          nextLessonFilename={nextLessonFilename}
          userId={learnerUserId ?? ""}
          setId={setId}
          source={source}
          setSlug={params.setSlug ?? ""}
          lessonFilename={filename}
          onMarkComplete={async () => {
            // Snapshot gamification before completion so
            // any milestone / badge crossed by the award
            // can be detected + celebrated afterwards.
            const userId = learnerUserId ?? "";
            const before = await captureCelebrationSnapshot(userId);
            await markCompleted();
            await celebrateProgressSince(
              userId,
              before,
              (badge) => ({
                name: t(badge.name_key, badge.key),
                description: t(badge.description_key, ""),
              }),
              (badge, newTier) => ({
                name: t(badge.name_key, badge.key),
                message: t(`gamification.tier.${newTier}`, newTier),
              }),
            );
            // Refresh daily missions so any whose progress
            // the just-completed lesson advanced flip to
            // complete (+ award their bonus XP). Best-effort.
            if (userId) {
              try {
                const r = await getStorage().missions.getDaily(userId, {
                  todayIso: localTodayIso(lang),
                });
                const allComplete =
                  r.missions.length > 0 && r.missions.every((m) => m.completed);
                celebrateMissions({
                  newlyCompletedCount: r.newlyCompleted.length,
                  allComplete,
                  lang,
                });
              } catch {
                /* missions are supplementary */
              }
            }
          }}
          onNextLesson={() => {
            if (nextLessonFilename) {
              navigate(
                `/lesson/${params.setSlug}/${setId}/${nextLessonFilename}`,
              );
            }
          }}
          onRepeat={() => goToStep(0)}
          onExit={() => navigate("/content")}
        />
      ) : (
        <article
          key={step!.id}
          className="lesson-step flex-auto"
          data-testid={`lesson-step-${step!.id}`}
          data-step-type={step!.type}
        >
          {step!.title && <h2>{step!.title}</h2>}
          {/* #140 — re-read the relevant theory from an
                        exercise step. Rendered once here so all five
                        renderers inherit it; subtle so it doesn't
                        distract from practising. */}
          {step!.type !== "theory" && precedingTheoryIndex !== null && (
            <div className="mb-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto min-h-11 gap-1.5 px-0 text-[var(--fg-secondary)] hover:text-[var(--accent-text)]"
                onClick={openTheoryFromExercise}
                data-testid="exercise-theory-link"
              >
                <BookOpen size={14} aria-hidden="true" />
                {t("lesson.exercise.reread_theory", "Re-read theory")}
              </Button>
            </div>
          )}
          {step!.type === "theory" ? (
            <>
              {theoryReturnIndex !== null && (
                <div className="mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 gap-1.5"
                    onClick={returnToExercise}
                    data-testid="theory-back-to-exercise"
                  >
                    <ChevronLeft aria-hidden="true" />
                    {t("lesson.exercise.back_to_exercise", "Back to exercise")}
                  </Button>
                </div>
              )}
              <TheoryStep
                body={step!.body ?? ""}
                stepId={step!.id}
                ttsLang={lesson.target_language}
                tts={tts}
                lessonRewriteFn={(s) => rewriteAnchors(s, lesson)}
                onAnchorClick={goToStepById}
                exampleUrl={step!.example_url}
                exampleLabel={step!.example_label}
              />
            </>
          ) : enteredReviewed &&
            reviewedRaw === null &&
            step!.exercise != null ? (
            // Legacy revisit: the step was completed before
            // raw answers were persisted, so reconstruct
            // nothing — show a compact locked "completed"
            // panel so the learner cannot re-answer it.
            <ReviewedFallbackPanel
              exercise={step!.exercise}
              stored={progress?.step_results?.[step!.id]}
            />
          ) : (
            <ExerciseDispatcher
              ref={exerciseRef}
              controlled
              onInteraction={setAnswerable}
              reviewed={reviewedRaw}
              step={step!}
              setId={setId}
              lessonId={filename}
              source={source}
              targetLanguage={lesson.target_language}
              sourceLanguage={lesson.source_language}
              domain={lesson.domain}
              cards={lesson.cards}
              onComplete={async (scored) => {
                if (!step!.exercise) return;
                // Flip to the "Weiter" phase the moment
                // the answer is graded (Problem 1).
                setChecked(true);
                // Persist the user's text-form answer.
                // free_text + word_tiles carry a coherent text answer
                // in the attempt; matching + picture_choice store only
                // a structured raw_answer, so #167 bug 1 reconstructs a
                // readable form (the chosen image label / the user's
                // pairings) instead of leaving it null. cloze stays null
                // (its blanks are diffed in-context).
                const exerciseType = step!.exercise.type;
                const stepUserAnswer =
                  exerciseType === "free_text" || exerciseType === "word_tiles"
                    ? (scored.attempts[0]?.user_answer ?? null)
                    : formatUserAnswer(
                        step!.exercise,
                        scored.raw_answer ?? null,
                      );
                await recordStepResult({
                  step_id: step!.id,
                  correct: scored.correct,
                  total: scored.total,
                  user_answer: stepUserAnswer,
                  // BUG P1 / Problem 2 — persist the
                  // raw answer so a revisit re-renders
                  // the exact locked visual.
                  raw_answer: scored.raw_answer ?? null,
                });
                // Phase 46B — persist per-element
                // attempts alongside the per-step
                // score. Failures here MUST NOT
                // block the step from advancing
                // (the per-step score is the
                // user's primary feedback).
                if (scored.attempts.length > 0 && learnerUserId) {
                  try {
                    await getStorage().elementErrors.recordBulk(
                      learnerUserId,
                      scored.attempts,
                    );
                  } catch (err) {
                    console.warn("elementErrors.recordBulk failed:", err);
                  }
                }
              }}
            />
          )}
        </article>
      )}

      <nav
        className="sticky bottom-0 z-10 mt-4 flex flex-row items-center gap-2 border-t border-border bg-bg-primary py-3"
        data-testid="lesson-footer"
        aria-label={t("lesson.nav.aria_label", "Step navigation")}
      >
        <Button
          type="button"
          variant="outline"
          className="min-w-[44px]"
          onClick={goPrev}
          disabled={currentStepIndex === 0}
          data-testid="lesson-prev"
          aria-label={t("lesson.action.prev", "Previous")}
          title={t("lesson.action.prev", "Previous")}
        >
          <ChevronLeft size={20} aria-hidden="true" />
          <span className="hidden md:inline">
            {t("lesson.action.prev", "Previous")}
          </span>
        </Button>
        {!isSummary &&
          (isExerciseStep && !checked && !enteredReviewed ? (
            <Button
              type="button"
              className="ml-auto"
              onClick={() => exerciseRef.current?.submit()}
              disabled={!answerable}
              title={
                !answerable
                  ? t(
                      "lesson.button.check_disabled_hint",
                      "Answer the exercise first",
                    )
                  : undefined
              }
              data-testid="lesson-check"
            >
              <Check size={20} aria-hidden="true" />
              {t("lesson.button.check", "Check")}
            </Button>
          ) : (
            <Button
              type="button"
              className="ml-auto"
              onClick={goNext}
              data-testid="lesson-next"
            >
              {isLastStep
                ? t("lesson.action.finish", "Finish lesson")
                : t("lesson.button.next", "Next")}
              <ChevronRight size={20} aria-hidden="true" />
            </Button>
          ))}
      </nav>

      {/* Floating read-aloud mini-player (C8) — visible while the
                engine is active; step-based skip through the theory
                block + play/pause + stop. */}
      {tts.speaking && (
        <LessonTtsMiniPlayer
          paused={tts.paused}
          position={theoryBlock?.position ?? 0}
          total={theoryBlock?.total ?? 0}
          hasPrev={theoryBlock !== null && currentStepIndex > theoryBlock.start}
          hasNext={theoryBlock !== null && currentStepIndex < theoryBlock.end}
          onPrev={() => readTheoryStepAt(currentStepIndex - 1)}
          onPlayPause={() => (tts.paused ? tts.resume() : tts.pause())}
          onNext={() => readTheoryStepAt(currentStepIndex + 1)}
          onStop={() => tts.stop()}
        />
      )}
    </main>
  );
}
