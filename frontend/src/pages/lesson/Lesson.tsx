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
import { useNavigate, useParams } from "react-router-dom";

import LessonResumeDialog from "../../components/lesson/dialogs/LessonResumeDialog";
import LessonSummary from "../../components/lesson/summary/LessonSummary";
import LessonResources from "../../components/lesson/steps/LessonResources";
import LessonFavoriteToggle from "../../components/lesson/chrome/LessonFavoriteToggle";
import LessonHeader from "../../components/lesson/chrome/LessonHeader";
import LessonProgressBar from "../../components/lesson/chrome/LessonProgressBar";
import LessonTtsControls from "../../components/lesson/tts/LessonTtsControls";
import LessonStepView from "../../components/lesson/steps/LessonStepView";
import LessonFooterNav from "../../components/lesson/chrome/LessonFooterNav";
import LessonTtsMiniPlayerSlot from "../../components/lesson/tts/LessonTtsMiniPlayerSlot";
import LessonStatusView, {
  resolveLessonStatusKind,
} from "../../components/lesson/steps/LessonStatusView";
import { useLessonAutoRead } from "../../hooks/lesson/useLessonAutoRead";
import type { ExerciseHandle } from "../../components/exercises/exercise-control";
import {
  isPlayableExerciseStep,
  storedStepResult,
} from "../../lib/lesson/lesson-step-state";
import { useI18n } from "../../hooks/ui/useI18n";
import { useLesson } from "../../hooks/lesson/useLesson";
import { useLessonFlowControl } from "../../hooks/lesson/useLessonFlowControl";
import { useLessonNavigation } from "../../hooks/lesson/useLessonNavigation";
import {
  useLessonEnterKey,
  type LessonEnterNav,
} from "../../hooks/lesson/useLessonEnterKey";
import { useLessonShortcuts } from "../../hooks/lesson/useLessonShortcuts";
import {
  captureCelebrationSnapshot,
  celebrateProgressSince,
} from "../../lib/feedback/celebration-stats";
import { localTodayIso } from "../../lib/missions/schedule";
import { clearHintUsage } from "../../lib/hints/hint-usage";
import { lessonMotivation } from "../../lib/lesson/motivation";
import { notify } from "../../utils/notify";
import { celebrateMissions } from "../../lib/praise/celebration-bus";
import { readLearnerState } from "../../lib/learning/learnerState";
import { getStorage } from "../../storage";
import type { ContentSetBook, RawAnswer } from "../../storage/types";

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

  // #594 Hint Economy — start each lesson with a clean hint-usage slate
  // so a hint on a reused exercise id from a prior lesson never bleeds.
  useEffect(() => {
    clearHintUsage();
  }, [source, setId, filename]);

  // BUG P1 / Problem 1 — two-phase "Prüfen" → "Weiter" button.
  // The active exercise reports whether its answer is checkable
  // (``answerable``) so the shared button can enable; the parent
  // drives evaluation through ``exerciseRef`` on the "Prüfen"
  // click; ``checked`` flips once the answer is graded so the
  // next click advances. All three reset whenever the step
  // changes (so a fresh exercise starts at "Prüfen" disabled).
  const exerciseRef = useRef<ExerciseHandle>(null);
  // #959 — scroll anchor placed just above the progress bar so a step
  // change can bring the task into view on mobile (see the effect below).
  const stepScrollRef = useRef<HTMLDivElement>(null);
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
    const stored = storedStepResult(lesson, currentStepIndex, progress);
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

  // Mid-lesson motivation (#586): a subtle toast at the halfway step and
  // on the last step. The ref guards against StrictMode double-effect +
  // re-renders so each step fires at most once.
  const motivationStepRef = useRef<number>(-1);
  useEffect(() => {
    if (!lesson) return;
    const total = lesson.steps.length;
    if (currentStepIndex >= total) return; // summary screen
    if (motivationStepRef.current === currentStepIndex) return;
    motivationStepRef.current = currentStepIndex;
    const kind = lessonMotivation(currentStepIndex, total);
    // Pass-through + short so the bottom-right motivation toast never
    // blocks the sticky lesson footer's Check/Next buttons (#589 fix).
    const motivationToast = {autoClose: 3000, passThrough: true} as const;
    if (kind === "halftime") {
      notify.info(
        t("lesson.motivation.halftime", "Halfway there — keep going!"),
        motivationToast,
      );
    } else if (kind === "last") {
      notify.info(
        t("lesson.motivation.last", "Last one — finish strong!"),
        motivationToast,
      );
    }
  }, [lesson, currentStepIndex, t]);

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
  // EXP-029 — the set's domain, used to surface domain-level media.yaml
  // resources in the "Vertiefe das Thema" section. Falls back to the
  // lesson's own domain when the set lookup misses.
  const [setDomain, setSetDomain] = useState<string | null>(null);
  // #769 — the set's manifest book, surfaced as the first "Vertiefe das
  // Thema" media item.
  const [setBook, setSetBook] = useState<ContentSetBook | null>(null);
  useEffect(() => {
    if (!setId) {
      setSetTitle(null);
      setSetDomain(null);
      setSetBook(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await getStorage().contentLoader.listSets();
        if (cancelled) return;
        const match = list.sets.find((s) => s.id === setId);
        setSetTitle(match?.title ?? null);
        setSetDomain(match?.domain ?? null);
        setSetBook(match?.book ?? null);
      } catch {
        if (!cancelled) {
          setSetTitle(null);
          setSetDomain(null);
          setSetBook(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setId]);

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

  const totalSteps = lesson.steps.length;
  const isSummary = currentStepIndex >= totalSteps;
  const step = isSummary ? null : lesson.steps[currentStepIndex];
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
    goNext,
  };

  return (
    <main
      id="main"
      className="page lesson-page flex flex-col min-h-full"
      data-testid="lesson-page"
    >
      <LessonHeader
        lesson={lesson}
        setTitle={setTitle}
        currentStepIndex={currentStepIndex}
        isInProgress={isInProgress}
        exitOpen={exitOpen}
        onPauseClick={() => setExitOpen(true)}
        onExit={() => navigate("/content?tab=my")}
        onExitContinue={() => setExitOpen(false)}
        onExitPause={() => void handlePauseFromDialog()}
        onExitAbandon={() => void handleAbandonFromDialog()}
      />

      <div className="flex justify-end px-2">
        <LessonFavoriteToggle
          userId={learnerUserId ?? ""}
          source={source}
          setId={setId}
          filename={filename}
          title={lesson.title}
          setTitle={setTitle ?? ""}
        />
      </div>

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

      {/* #959 — keep "Step n of m" visible while reading: the bar sticks to
          the top of the scroll container (all viewports). The lesson nav
          auto-hides on scroll-down, so the bar fills the space it vacates;
          z-10 stays below the nav (z-50) when the nav is shown. */}
      <LessonProgressBar
        isSummary={isSummary}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        className="sticky top-0 z-10"
      />

      <LessonTtsControls
        isSummary={isSummary}
        lesson={lesson}
        tts={tts}
        autoRead={autoRead}
        toggleAutoRead={toggleAutoRead}
        startContinuous={startContinuous}
        isContinuous={isContinuous}
        continuousAvailable={continuousAvailable}
      />

      {isSummary ? (
        <>
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
          onExit={() => navigate("/content?tab=my")}
        />
        <LessonResources
          lesson={lesson}
          setDomain={setDomain}
          setBook={setBook}
        />
        </>
      ) : (
        <LessonStepView
          step={step!}
          lesson={lesson}
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
        />
      )}

      <LessonFooterNav
        isSummary={isSummary}
        isExerciseStep={isExerciseStep}
        checked={checked}
        enteredReviewed={enteredReviewed}
        answerable={answerable}
        isLastStep={isLastStep}
        currentStepIndex={currentStepIndex}
        goPrev={goPrev}
        goNext={goNext}
        onCheck={() => exerciseRef.current?.submit()}
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
  );
}
