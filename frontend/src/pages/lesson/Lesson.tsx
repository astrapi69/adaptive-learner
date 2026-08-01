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

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import LessonResumeDialog from "../../components/lesson/dialogs/LessonResumeDialog";
import LessonExitDialog from "../../components/lesson/dialogs/LessonExitDialog";
import LessonTimedStatus from "../../components/lesson/chrome/LessonTimedStatus";
import { LessonModeProvider } from "../../hooks/lesson/modes/useLessonMode";
import { TestModeProvider } from "../../hooks/lesson/modes/useTestMode";
import TestModeBanner from "../../components/lesson/testmode/TestModeBanner";
import TestModeActivationZone from "../../components/lesson/testmode/TestModeActivationZone";
import { useTimedLesson } from "../../hooks/lesson/modes/useTimedLesson";
import {
  readDefaultLessonMode,
  type LessonMode,
} from "../../lib/learning/lessonModePref";
import { configForMode } from "../../lib/learning/lessonModeConfig";
import { maybeReverseLesson } from "../../lib/reverse/reverse-lesson";
import LessonReverseNote from "../../components/lesson/chrome/LessonReverseNote";
import LessonSummaryScreen from "../../components/lesson/summary/LessonSummaryScreen";
import LessonHeader from "../../components/lesson/chrome/LessonHeader";
import LessonOptionsBar from "../../components/lesson/chrome/LessonOptionsBar";
import LessonProgressBar from "../../components/lesson/chrome/LessonProgressBar";
import LessonStepView from "../../components/lesson/steps/LessonStepView";
import LessonFooterNav from "../../components/lesson/chrome/LessonFooterNav";
import LessonTtsMiniPlayerSlot from "../../components/lesson/tts/LessonTtsMiniPlayerSlot";
import LessonStatusView, {
  resolveLessonStatusKind,
} from "../../components/lesson/steps/LessonStatusView";
import { useLessonAutoRead } from "../../hooks/lesson/audio/useLessonAutoRead";
import { isPlayableExerciseStep } from "../../lib/lesson/lesson-step-state";
import { useI18n } from "../../hooks/ui/useI18n";
import { useLesson } from "../../hooks/lesson/session/useLesson";
import { useLessonFlowControl } from "../../hooks/lesson/session/useLessonFlowControl";
import { useLessonMotivation } from "../../hooks/lesson/session/useLessonMotivation";
import { useLessonNavigation } from "../../hooks/lesson/session/useLessonNavigation";
import { useLessonSetContext } from "../../hooks/lesson/session/useLessonSetContext";
import { useLessonStepState } from "../../hooks/lesson/session/useLessonStepState";
import { useOrientationReanchor } from "../../hooks/lesson/interaction/useOrientationReanchor";
import { clearHintUsage } from "../../lib/hints/hint-usage";
import { readLearnerState } from "../../lib/learning/learnerState";

interface UrlParams {
  setSlug: string;
  setId: string;
  filename: string;
  [key: string]: string | undefined;
}

export default function LessonPage() {
  const params = useParams<UrlParams>();
  const navigate = useNavigate();
  const { t } = useI18n();

  const source = useMemo(
    () => (params.setSlug ?? "").replace(/--/g, "/"),
    [params.setSlug],
  );
  const setId = params.setId ?? "";
  const filename = params.filename ?? "";

  // #1007 — Practice / Exam / Timed mode. Seeded from the learner's
  // default-mode setting; switchable until the lesson is under way (so the
  // rules can't change mid-run). Practice keeps every aid on; exam hides
  // the scaffolding (hints, theory recap, auto-read, solution toggles,
  // celebration). Declared before useLesson so the mode is persisted on
  // every progress upsert (#1007 Phase 2 — XP + SRS read the attempt's
  // mode). Default ``practice`` keeps the lower-pressure mode for new
  // learners.
  const [lessonMode, setLessonMode] = useState<LessonMode>(() =>
    readDefaultLessonMode(),
  );
  const modeConfig = configForMode(lessonMode);

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
  } = useLesson({ source, setId, lessonFilename: filename, lessonMode });

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

  // #1013 — reverse mode flips each exercise's drill direction (matching
  // gets its columns flipped; other types stay original + show a
  // "(not reversible)" note). Memoized so the played exercise objects keep
  // a stable identity across renders — a fresh object every render would
  // remount the active exercise and wipe the in-progress answer. The
  // synthetic lesson is purely presentational: ``useLesson`` keeps the
  // original ``lesson`` for progress IO (step ids are preserved).
  const playedLesson = useMemo(
    () => maybeReverseLesson(lesson, modeConfig.cardDirection),
    [lesson, modeConfig.cardDirection],
  );

  // #594 Hint Economy — start each lesson with a clean hint-usage slate
  // so a hint on a reused exercise id from a prior lesson never bleeds.
  useEffect(() => {
    clearHintUsage();
  }, [source, setId, filename]);

  // The two-phase check state cluster (exercise handle, answerable /
  // checked / reviewed flags, render-phase per-step reset, Enter
  // shortcut) lives in the extracted hook (#1790).
  const {
    exerciseRef,
    answerable,
    setAnswerable,
    checked,
    setChecked,
    enteredReviewed,
    reviewedRaw,
    enterStateRef,
  } = useLessonStepState({lesson, currentStepIndex, progress});
  // #959 — scroll anchor placed just above the progress bar so a step
  // change can bring the task into view on mobile (see the effect below).
  const stepScrollRef = useRef<HTMLDivElement>(null);

  // #1009 — timed-mode orchestration (countdown length, timeout
  // auto-advance, correct-answer bonus, end-of-run timing stats). Inert
  // unless the lesson runs in timed mode, so practice/exam are unaffected.
  const timed = useTimedLesson({
    enabled: lessonMode === "timed",
    lesson,
    currentStepIndex,
    checked,
    progress,
    recordStepResult,
    goNext,
  });

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

  // Mid-lesson motivation toast (#586) lives in the extracted hook (#1790).
  useLessonMotivation({lesson, currentStepIndex});

  // #959 — the lesson header (set line + title + description) eats too
  // much vertical space on EVERY viewport, so the progress bar + step
  // content start below the fold and the learner has to scroll on each of
  // the steps. After load + each step change, bring the content into view
  // so they see the task, not the header. All viewports; honors
  // prefers-reduced-motion.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (showResumePrompt) return; // let the resume overlay settle first
    const target = stepScrollRef.current;
    if (!target?.scrollIntoView) return; // jsdom/happy-dom: no-op
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [currentStepIndex, showResumePrompt]);

  // #1422 — after a device ROTATION, re-anchor the same step anchor: iOS
  // leaves stale scroll offsets / sticky positions after an orientation
  // change until the next scroll, which can strand the task + the sticky
  // footer outside the freshly-sized viewport.
  useOrientationReanchor(stepScrollRef, !showResumePrompt);

  // Next-lesson pointer + set title/domain/book (three silent-degrade
  // mount reads) live in the extracted hook (#1790).
  const {nextLessonFilename, setTitle, setDomain, setBook} =
    useLessonSetContext({source, setId, filename});

  const statusKind = resolveLessonStatusKind(
    source,
    setId,
    filename,
    status,
    lesson,
  );
  if (statusKind) return <LessonStatusView kind={statusKind} error={error} />;
  // ``resolveLessonStatusKind`` already returns "error" when the lesson
  // is null, so this only narrows the type for the code below.
  if (lesson === null) return null;

  // #1013 — the lesson actually played (reverse mode flips the exercises;
  // identical to ``lesson`` in every other mode). ``maybeReverseLesson``
  // returns ``lesson`` itself (or a transform of it), so it is non-null
  // whenever ``lesson`` is — assert the type without adding a branch.
  const played = playedLesson as NonNullable<typeof playedLesson>;
  const totalSteps = played.steps.length;
  const isSummary = currentStepIndex >= totalSteps;
  const step = isSummary ? null : played.steps[currentStepIndex];
  // An exercise step gates the two-phase button; theory steps
  // (and any unsupported/placeholder exercise type) keep the
  // plain always-enabled "Next" button so the user is never
  // stuck on a step they can't "check".
  const isExerciseStep = isPlayableExerciseStep(step);
  const isLastStep = currentStepIndex + 1 === totalSteps;
  // Keep the Enter-shortcut listener (#103) reading the latest step
  // state without re-subscribing on every render.
  enterStateRef.current = {
    isSummary,
    isExerciseStep,
    checked,
    enteredReviewed,
    answerable,
    // #1007 Phase 2 — exam: Enter submits + advances in one keystroke.
    delayedFeedback: !modeConfig.immediateFeedback,
    goNext,
  };

  return (
    <TestModeProvider>
    <main
      id="main"
      className="lesson-page flex flex-col min-h-full"
      data-testid="lesson-page"
    >
      <LessonHeader lesson={lesson} setTitle={setTitle} />

      {/* #2319 — visible while test mode is active (preview build only). */}
      <TestModeBanner />

      {/* #1642 — the pause control moved into the footer; the exit dialog it
          opens is lifted here (portal, controlled by the lesson's exitOpen
          state) so both the header and the footer stay presentational. */}
      <LessonExitDialog
        open={exitOpen}
        onContinue={() => setExitOpen(false)}
        onPause={() => void handlePauseFromDialog()}
        onAbandon={() => void handleAbandonFromDialog()}
      />

      {/* #1648 — the summary's favorite lives in the labelled
          SummaryFavorite row inside LessonSummary; the old isolated
          top-right star here was a duplicate of the same toggle and was
          removed. During the active lesson the favorite lives in the
          collapsible options group (#1625). */}

      {/* Phase 63C — resume prompt overlays the step view.
                The user must choose before they can interact with
                the lesson content. */}
      <LessonResumeDialog
        open={showResumePrompt}
        lessonTitle={lesson.title}
        onResume={() => void handleResume()}
        onStartOver={() => void handleStartOver()}
      />

      {/* #959 — scroll anchor: a step change scrolls this to the top of
          the viewport, lifting the header off-screen so the progress bar +
          task land in view. scroll-mt leaves a little gap under the
          (auto-hiding) nav. */}
      <div ref={stepScrollRef} aria-hidden="true" className="scroll-mt-4" />

      {/* #959 — keep "Step n of m" visible while reading: the row sticks to
          the top of the scroll container (all viewports). The lesson nav
          auto-hides on scroll-down, so the row fills the space it vacates;
          z-10 stays below the nav (z-50) when the nav is shown. The
          bg-token backs the sticky row so scrolled content never bleeds
          through the gaps around the button.

          #1942 — the progress indicator and the collapsible options group
          share ONE flex row: the bar grows to take the available width and
          the "Options" button sits beside it (instead of stacking on its
          own line below). ``flex-wrap`` + a bar min-width keeps it graceful
          — on very narrow viewports (or once the options panel is expanded
          and its body needs the room) the options block wraps onto its own
          line. ``items-start`` pins the bar to the top so an expanded panel
          can't drag it to the vertical centre. */}
      <div
        className="sticky top-0 z-10 flex flex-wrap items-start gap-2 bg-bg-primary py-3"
        data-testid="lesson-progress-options-row"
      >
        {/* #2319 — the progress bar doubles as the hidden test-mode
            activation target (six quick taps; inert unless the build opted
            in). display:contents keeps the bar's flex sizing. */}
        <TestModeActivationZone>
          <LessonProgressBar
            isSummary={isSummary}
            currentStepIndex={currentStepIndex}
            totalSteps={totalSteps}
            className="my-0 min-w-[8rem] flex-1"
          />
        </TestModeActivationZone>

        {/* #1625 — the lesson's mode/display SETTINGS (favorite, mode
            toggle, auto read-aloud) are bundled into one compact,
            collapsible group (LessonOptionsBar) so they stop eating the
            vertical space above the exercise on mobile. Default collapsed;
            the group resets to collapsed per lesson and preserves the
            choice across step changes. Renders nothing on the summary
            screen. */}
        <LessonOptionsBar
          isSummary={isSummary}
          className="shrink-0"
          userId={learnerUserId ?? ""}
          source={source}
          setId={setId}
          filename={filename}
          title={lesson.title}
          setTitle={setTitle ?? ""}
          lessonMode={lessonMode}
          onModeChange={setLessonMode}
          modeLocked={isInProgress}
          showReadAloud={modeConfig.showReadAloud}
          lesson={lesson}
          tts={tts}
          autoRead={autoRead}
          toggleAutoRead={toggleAutoRead}
          startContinuous={startContinuous}
          isContinuous={isContinuous}
          continuousAvailable={continuousAvailable}
        />
      </div>

      {/* #1009 — timed-mode per-question countdown + time-up notice. */}
      <LessonTimedStatus
        lessonMode={lessonMode}
        isSummary={isSummary}
        isExerciseStep={isExerciseStep}
        remainingSeconds={timed.remainingSeconds}
        limitSeconds={timed.limitSeconds}
        bonusSeconds={timed.bonusSeconds}
        timedOut={timed.timedOut}
      />

      <LessonModeProvider mode={lessonMode}>
      {isSummary ? (
        <>
        <LessonSummaryScreen
          lesson={played}
          originalLesson={lesson}
          progress={progress}
          lessonMode={lessonMode}
          timedStats={lessonMode === "timed" ? timed.stats : null}
          nextLessonFilename={nextLessonFilename}
          userId={learnerUserId ?? ""}
          setId={setId}
          setTitle={setTitle ?? ""}
          source={source}
          setSlug={params.setSlug ?? ""}
          lessonFilename={filename}
          setDomain={setDomain}
          setBook={setBook}
          markCompleted={markCompleted}
          markRestarted={markRestarted}
          goToStep={goToStep}
        />
        </>
      ) : (
        <>
        {/* #1013 — reverse mode can't gradeably reverse non-matching
            exercise types, so they play in their original format with this
            note (the issue's documented fallback). */}
        <LessonReverseNote
          reverseMode={modeConfig.cardDirection === "reverse"}
          isExerciseStep={isExerciseStep}
          step={step}
        />
        <LessonStepView
          step={step!}
          lesson={played}
          setId={setId}
          lessonFilename={filename}
          source={source}
          tts={tts}
          precedingTheoryIndex={precedingTheoryIndex}
          theoryReturnIndex={theoryReturnIndex}
          openTheoryFromExercise={openTheoryFromExercise}
          returnToExercise={returnToExercise}
          goToStepById={goToStepById}
          enteredReviewed={enteredReviewed}
          reviewedRaw={reviewedRaw}
          progress={progress}
          exerciseRef={exerciseRef}
          learnerUserId={learnerUserId}
          onInteraction={setAnswerable}
          onChecked={() => setChecked(true)}
          recordStepResult={recordStepResult}
          // #1218 — a fully-correct answer offers an in-context
          // "Continue" (the success-merge) that calls the SAME forward
          // navigation as the two-phase footer; the label matches the
          // footer's Next / Finish wording.
          onAdvance={goNext}
          advanceLabel={
            isLastStep
              ? t("lesson.action.finish", "Finish lesson")
              : t("lesson.button.next", "Continue")
          }
        />
        </>
      )}
      </LessonModeProvider>

      <LessonFooterNav
        isSummary={isSummary}
        isExerciseStep={isExerciseStep}
        checked={checked}
        enteredReviewed={enteredReviewed}
        answerable={answerable}
        isLastStep={isLastStep}
        currentStepIndex={currentStepIndex}
        // #1007 Phase 2 — exam hides per-question feedback: one button that
        // submits + advances, forward-only. The synchronous submit() grades
        // + records, then goNext unmounts the step in the same React batch,
        // so the renderer's correct/wrong line never paints (revealed only
        // on the end-of-exam summary).
        delayedFeedback={!modeConfig.immediateFeedback}
        isInProgress={isInProgress}
        onPause={() => setExitOpen(true)}
        onExit={() => navigate("/content?tab=my")}
        goPrev={goPrev}
        goNext={goNext}
        onCheck={() => exerciseRef.current?.submit()}
        onSubmitAndAdvance={() => {
          exerciseRef.current?.submit();
          goNext();
        }}
      />

      {/* Floating read-aloud mini-player (C8) — visible while the
                engine is active; step-based skip through the theory
                block + play/pause + stop. */}
      <LessonTtsMiniPlayerSlot
        tts={tts}
        theoryBlock={theoryBlock}
        currentStepIndex={currentStepIndex}
        onReadStepAt={readTheoryStepAt}
      />
    </main>
    </TestModeProvider>
  );
}
