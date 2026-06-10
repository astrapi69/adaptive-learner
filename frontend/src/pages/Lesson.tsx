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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  ExternalLink,
  Pause,
  RotateCcw,
  Square,
  Star,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Link, useNavigate, useParams } from "react-router-dom";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import CodeBlock from "../components/content/CodeBlock";
import LessonExitDialog from "../components/lesson/LessonExitDialog";
import LessonResumeDialog from "../components/lesson/LessonResumeDialog";
import NextStepSuggestions from "../components/lesson/NextStepSuggestions";
import { useNextStepSuggestions } from "../hooks/useNextStepSuggestions";
import { collectFailedExercises } from "../lib/lesson/error-replay";
import CorrectionBlock from "../components/exercises/CorrectionBlock";
import { notify } from "../utils/notify";
import DiffHighlight from "../components/exercises/DiffHighlight";
import {
  ExerciseDispatcher,
  resolveCodeContext,
  SUPPORTED_EXERCISE_TYPES,
} from "../components/exercises/ExerciseDispatcher";
import type { ExerciseHandle } from "../components/exercises/exercise-control";
import Confetti from "../components/feedback/Confetti";
import LessonTtsMiniPlayer from "../components/lesson/LessonTtsMiniPlayer";
import {
  collectTheoryRun,
  markdownToSpeech,
  runStepForChar,
  theoryBlockAround,
  type TheoryRun,
} from "../lib/lesson/tts-text";
import {
  READ_ALOUD_SPEEDS,
  readLessonAutoRead,
  useReadAloud,
  writeLessonAutoRead,
  type ReadAloudController,
} from "../hooks/useReadAloud";
import { useCountUp } from "../hooks/useCountUp";
import { useFeedbackIntensity } from "../hooks/useFeedbackIntensity";
import { useI18n } from "../hooks/useI18n";
import { useLesson } from "../hooks/useLesson";
import {
  useLessonEnterKey,
  type LessonEnterNav,
} from "../hooks/useLessonEnterKey";
import { useLessonShortcuts } from "../hooks/useLessonShortcuts";
import {
  captureCelebrationSnapshot,
  celebrateProgressSince,
} from "../lib/feedback/celebration-stats";
import { allowsConfetti } from "../lib/feedback/feedbackPref";
import { tokenDiff } from "../lib/exercises/token-diff";
import {
  buildLessonResultMarkdown,
  collectWeakAreas,
  formatUserAnswer,
  lessonResultFilename,
  type LessonResultLabels,
} from "../lib/lesson/result-export";
import { findPrecedingTheoryIndex } from "../lib/lesson/theory-link";
import { localTodayIso } from "../lib/missions/schedule";
import {
  celebrateMissions,
  emitCelebration,
} from "../lib/praise/celebration-bus";
import { nextPraise } from "../lib/praise/phrase-picker";
import { parseStepAnchor, rewriteAnchors } from "../lib/lesson-anchors";
import { readLearnerState } from "../lib/learnerState";
import {
  buildExerciseBreakdown,
  computeStars,
  type StarRating,
} from "../lib/lesson-summary";
import { getStorage } from "../storage";
import type {
  ContentLessonExercise,
  ContentLessonStep,
  ElementError,
  LessonStepResultStored,
  RawAnswer,
} from "../storage/types";

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

  // Phase 63B — back-button intercept + browser-close
  // auto-pause. The dialog gives the user explicit pause /
  // abandon / continue paths; the lifecycle handlers below
  // also auto-pause when the tab is hidden or the window
  // unloads while the lesson is still in progress.
  const [exitOpen, setExitOpen] = useState(false);
  // ``status === "in_progress"`` is the only state where an
  // auto-pause makes sense. ``progress`` is null until the
  // first upsert lands; we still allow an explicit pause from
  // the dialog because it will create the row on the way.
  const isInProgress = progress === null || progress.status === "in_progress";

  // Phase 63C — resume prompt. Shown once when the lesson is
  // loaded and the stored progress is in the ``paused`` state.
  // The user must choose before interacting with the step view.
  const [resumeChoiceMade, setResumeChoiceMade] = useState(false);
  const showResumePrompt =
    status === "ready" && progress?.status === "paused" && !resumeChoiceMade;

  const handleResume = async () => {
    await markResumed();
    setResumeChoiceMade(true);
    // currentStepIndex is already at the right position
    // (fetchInitial computed it from step_results on load).
  };

  const handleStartOver = async () => {
    await markRestarted();
    setResumeChoiceMade(true);
    goToStep(0);
  };

  // Phase 63B + 63E — auto-pause on hide, auto-resume on return.
  // ``autoSuspendedRef`` tracks whether THIS effect fired a pause
  // so the return-visible handler can reverse it without showing
  // the resume dialog (brief tab-switch case).
  const autoSuspendedRef = useRef(false);
  useEffect(() => {
    if (!isInProgress) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        autoSuspendedRef.current = true;
        void markPaused();
      } else if (autoSuspendedRef.current) {
        autoSuspendedRef.current = false;
        void markResumed();
      }
    };
    const onUnload = () => void markPaused();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [isInProgress, markPaused, markResumed]);

  // Phase 63E — 30-second autosave interval. Flushes accumulated
  // time to storage without changing lesson status so the
  // summary shows accurate time even on long theory steps.
  useEffect(() => {
    if (status !== "ready" || !isInProgress) return;
    const id = setInterval(() => void autosave(), 30_000);
    return () => clearInterval(id);
  }, [status, isInProgress, autosave]);

  const handlePauseFromDialog = async () => {
    await markPaused();
    setExitOpen(false);
    notify.info(
      t("lesson.exit.paused_toast", "Lesson paused. You can resume anytime."),
    );
    navigate("/content");
  };

  const handleAbandonFromDialog = async () => {
    await markAbandoned();
    setExitOpen(false);
    notify.info(t("lesson.exit.abandoned_toast", "Lesson abandoned."));
    navigate("/content");
  };

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

  // B2 (Tailwind migration) — scroll the viewport to the top on every
  // step change so a long step doesn't leave the learner mid-page.
  // Guarded for the headless test env (scrollTo may be a stub).
  useEffect(() => {
    try {
      document.getElementById("root")?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    } catch {
      /* no-op in environments without a real scroll. */
    }
  }, [currentStepIndex]);

  // TTS feature C3 — auto-read mode. The lesson-level engine reads
  // each new step aloud on display (theory body / exercise prompt);
  // code/formula exercises are skipped. Off by default; remembered.
  const tts = useReadAloud();
  const [autoRead, setAutoRead] = useState(() => readLessonAutoRead());
  const toggleAutoRead = useCallback(() => {
    setAutoRead((on) => {
      const next = !on;
      writeLessonAutoRead(next);
      if (!next) tts.stop();
      return next;
    });
  }, [tts]);

  // The speech payload (text + utterance id + lang) for the current
  // step, or null when there's nothing to read (summary, code
  // exercise, empty). Shared by auto-read + the keyboard shortcut.
  const currentStepSpeech = useCallback((): {
    text: string;
    id: string;
    lang?: string;
  } | null => {
    if (!lesson) return null;
    const current = lesson.steps[currentStepIndex];
    if (!current) return null;
    const lang = lesson.target_language ?? undefined;
    if (current.type === "theory") {
      const text = markdownToSpeech(current.body ?? "");
      // theory-{id} matches the TheoryStep so the follow-along
      // highlight renders for auto-read + shortcut too.
      return text.trim() ? { text, id: `theory-${current.id}`, lang } : null;
    }
    if (current.exercise) {
      const { codeMode } = resolveCodeContext(current.exercise, lesson.cards);
      if (!codeMode) {
        const text = current.exercise.prompt ?? "";
        return text.trim() ? { text, id: `prompt-${current.id}`, lang } : null;
      }
    }
    return null;
  }, [lesson, currentStepIndex]);

  // Speak the current step when auto-read is on and the step changes.
  // The ref guard means the effect can safely re-run on unrelated
  // renders (the tts controller object is recreated each render)
  // without re-speaking the same step.
  const autoReadStepRef = useRef(-1);
  useEffect(() => {
    if (!autoRead || !tts.enabled || !lesson) return;
    if (currentStepIndex >= lesson.steps.length || showResumePrompt) return;
    if (autoReadStepRef.current === currentStepIndex) return;
    autoReadStepRef.current = currentStepIndex;
    const payload = currentStepSpeech();
    if (payload) {
      tts.speak(payload.text, { lang: payload.lang, id: payload.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoRead,
    currentStepIndex,
    lesson,
    showResumePrompt,
    tts.enabled,
    currentStepSpeech,
  ]);

  // Reset the auto-read step guard when auto-read is turned off so
  // re-enabling it re-reads the current step.
  useEffect(() => {
    if (!autoRead) autoReadStepRef.current = -1;
  }, [autoRead]);

  // Keyboard shortcut (TTS feature, item 8): "R" toggles read-aloud
  // of the current step. Ignored while typing in an input / textarea
  // / contenteditable, or with a modifier held.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      ) {
        return;
      }
      if (!tts.enabled) return;
      e.preventDefault();
      if (tts.speaking) {
        tts.stop();
        return;
      }
      const payload = currentStepSpeech();
      if (payload) {
        tts.speak(payload.text, {
          lang: payload.lang,
          id: payload.id,
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tts, currentStepSpeech]);

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

  // TTS feature C7 — continuous theory reading. "Read all" speaks a
  // run of consecutive theory steps as ONE utterance and auto-
  // advances the viewer as the engine crosses each step boundary,
  // stopping at the first exercise.
  const CONTINUOUS_ID = "theory-run";
  const [theoryRun, setTheoryRun] = useState<TheoryRun | null>(null);
  const startContinuous = useCallback(() => {
    if (!lesson) return;
    const run = collectTheoryRun(lesson.steps, currentStepIndex);
    if (run.indices.length < 2 || !run.text.trim()) return;
    setTheoryRun(run);
    const lang = lesson.target_language ?? undefined;
    tts.speak(run.text, { lang, id: CONTINUOUS_ID });
  }, [lesson, currentStepIndex, tts]);

  // Auto-advance the viewer while the continuous run plays. When the
  // engine stops, clear the run.
  const isContinuous = tts.speaking && tts.activeId === CONTINUOUS_ID;

  // TTS feature C8 — mini-player step skip. Read a specific theory
  // step (navigating to it first) so the player's prev/next re-read
  // the right step with its follow-along highlight.
  const readTheoryStepAt = useCallback(
    (index: number) => {
      if (!lesson) return;
      const s = lesson.steps[index];
      if (!s || s.type !== "theory") return;
      const text = markdownToSpeech(s.body ?? "");
      goToStep(index);
      if (text.trim()) {
        tts.speak(text, {
          lang: lesson.target_language ?? undefined,
          id: `theory-${s.id}`,
        });
      }
    },
    [lesson, goToStep, tts],
  );
  // The contiguous theory block around the current step drives the
  // mini-player's "Step X of N" + prev/next availability.
  const theoryBlock = useMemo(
    () => (lesson ? theoryBlockAround(lesson.steps, currentStepIndex) : null),
    [lesson, currentStepIndex],
  );

  // "Read all" is offered only on a theory step that begins a run of
  // at least two consecutive theory steps.
  const continuousAvailable = useMemo(() => {
    if (!lesson) return false;
    const cur = lesson.steps[currentStepIndex];
    if (!cur || cur.type !== "theory") return false;
    return collectTheoryRun(lesson.steps, currentStepIndex).indices.length >= 2;
  }, [lesson, currentStepIndex]);
  useEffect(() => {
    if (!theoryRun) return;
    if (!isContinuous) {
      setTheoryRun(null);
      return;
    }
    const target = runStepForChar(theoryRun, tts.boundaryIndex);
    if (target >= 0 && target !== currentStepIndex) {
      goToStep(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.boundaryIndex, isContinuous, theoryRun]);

  // #140 — let an exercise step link back to the theory it
  // practices. The target is the nearest preceding theory step in
  // the same lesson (runtime-derived, no schema field). When the
  // learner follows the link we remember the origin exercise so a
  // "back to exercise" affordance on the theory step returns them
  // exactly where they were.
  const [theoryReturnIndex, setTheoryReturnIndex] = useState<number | null>(
    null,
  );
  const precedingTheoryIndex = useMemo(
    () =>
      lesson ? findPrecedingTheoryIndex(lesson.steps, currentStepIndex) : null,
    [lesson, currentStepIndex],
  );
  const openTheoryFromExercise = useCallback(() => {
    if (precedingTheoryIndex === null) return;
    setTheoryReturnIndex(currentStepIndex);
    goToStep(precedingTheoryIndex);
  }, [precedingTheoryIndex, currentStepIndex, goToStep]);
  const returnToExercise = useCallback(() => {
    if (theoryReturnIndex === null) return;
    const target = theoryReturnIndex;
    setTheoryReturnIndex(null);
    goToStep(target);
  }, [theoryReturnIndex, goToStep]);
  // Drop the pending return target once the learner is on a
  // non-theory step again (they returned, or moved on via the
  // lesson's own prev/next) so the back affordance never lingers.
  useEffect(() => {
    if (!lesson) return;
    const cur = lesson.steps[currentStepIndex];
    if (cur && cur.type !== "theory" && theoryReturnIndex !== null) {
      setTheoryReturnIndex(null);
    }
  }, [lesson, currentStepIndex, theoryReturnIndex]);

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
                className="h-auto min-h-11 gap-1.5 px-0 text-[var(--fg-muted)] hover:text-[var(--accent-text)]"
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
                    variant="ghost"
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
                    // eslint-disable-next-line no-console
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TheoryStepProps {
  body: string;
  /** Stable id of this theory step (keys the engine's active read). */
  stepId: string;
  /** TTS feature C2 — lesson target language for read-aloud. */
  ttsLang?: string | null;
  /** TTS feature C5 — the shared lesson read-aloud engine, so the
   *  theory button drives it (manual + auto both emit boundaries)
   *  and the follow-along highlight can track the spoken word. */
  tts: ReadAloudController;
  lessonRewriteFn: (body: string) => string;
  onAnchorClick: (stepId: string) => void;
  /** Schema v1.4 (#139) — optional external example link. */
  exampleUrl?: string | null;
  exampleLabel?: string | null;
}

function TheoryStep({
  body,
  stepId,
  ttsLang = null,
  tts,
  lessonRewriteFn,
  onAnchorClick,
  exampleUrl = null,
  exampleLabel = null,
}: TheoryStepProps) {
  const { t } = useI18n();
  const rewritten = useMemo(
    () => lessonRewriteFn(body),
    [body, lessonRewriteFn],
  );
  // Plain-text projection of the body for read-aloud (markdown
  // syntax + code blocks stripped).
  const speechText = useMemo(() => markdownToSpeech(body), [body]);
  const utteranceId = `theory-${stepId}`;
  const isReading = tts.speaking && tts.activeId === utteranceId;
  const canRead = tts.enabled && !!ttsLang && speechText.length > 0;
  const readLabel = isReading
    ? t("lesson.tts.stop", "Stop")
    : t("lesson.tts.read_aloud", "Read aloud");
  return (
    <div
      className="lesson-theory markdown-body"
      data-testid="lesson-theory-body"
    >
      {canRead && (
        <div className="lesson-theory-tts">
          <button
            type="button"
            className={`read-aloud-button${isReading ? " is-speaking" : ""}`}
            data-testid="read-aloud-theory"
            data-speaking={isReading ? "true" : "false"}
            aria-label={readLabel}
            onClick={() =>
              isReading
                ? tts.stop()
                : tts.speak(speechText, {
                    lang: ttsLang ?? undefined,
                    id: utteranceId,
                  })
            }
          >
            <span className="read-aloud-button__icon" aria-hidden="true">
              {isReading ? <Square size={14} /> : <Volume2 size={14} />}
            </span>
            <span className="read-aloud-button__label">{readLabel}</span>
          </button>
        </div>
      )}
      {/* #147 — read-aloud only plays audio; the panel keeps its
                rendered Markdown formatting. It used to swap to a
                plain-text follow-along while speaking, which dropped
                headings / lists / bold / code and visibly reflowed the
                panel. The spoken-word position still drives continuous
                reading via tts.boundaryIndex, just without re-rendering
                the body. */}
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeAutolinkHeadings]}
        components={{
          // Fenced code blocks (```python ...) render via the
          // syntax-highlighted CodeBlock (schema v1.3). Inline
          // `code` stays a plain <code>. ``pre`` is collapsed to
          // its children so CodeBlock's own <pre> isn't nested.
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const match = /language-([\w-]+)/.exec(className ?? "");
            if (match) {
              return (
                <CodeBlock code={String(children ?? "")} language={match[1]} />
              );
            }
            return <code className={className}>{children}</code>;
          },
          a: ({ href, children, ...rest }) => {
            const stepId = href !== undefined ? parseStepAnchor(href) : null;
            if (stepId !== null) {
              return (
                <a
                  {...rest}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    onAnchorClick(stepId);
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a {...rest} href={href}>
                {children}
              </a>
            );
          },
        }}
      >
        {rewritten}
      </Markdown>
      {/* #139 — optional external example link under the theory
                content. Rendered only when the author supplied one
                (rule: a function not available is not offered). */}
      {exampleUrl ? (
        <div className="mt-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5"
          >
            <a
              href={exampleUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="theory-example-link"
            >
              <ExternalLink aria-hidden="true" />
              {exampleLabel?.trim()
                ? exampleLabel
                : t("lesson.theory.view_example", "Beispiel ansehen")}
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface ReviewedFallbackPanelProps {
  exercise: ContentLessonExercise;
  stored: LessonStepResultStored | undefined;
}

/** Compact locked view for a step completed BEFORE raw answers
 *  were persisted (BUG P1 / Problem 2 legacy path). New
 *  completions reconstruct the exact exercise visual via the
 *  ``reviewed`` prop; this fallback only shows the prompt + the
 *  stored score so the learner cannot re-answer it. */
function ReviewedFallbackPanel({
  exercise,
  stored,
}: ReviewedFallbackPanelProps) {
  const { t } = useI18n();
  const correct = stored?.correct ?? 0;
  const total = stored?.total ?? 0;
  const allCorrect = total > 0 && correct === total;
  return (
    <section
      className="lesson-reviewed-fallback"
      data-testid="lesson-reviewed-fallback"
    >
      <p className="lesson-reviewed-prompt">{exercise.prompt}</p>
      <p
        className={`lesson-reviewed-status answer-feedback${
          allCorrect ? " is-correct" : " is-wrong"
        }`}
        data-testid="lesson-reviewed-status"
        data-result={allCorrect ? "correct" : "wrong"}
      >
        <CheckCircle2 size={16} aria-hidden="true" />
        {t("lesson.reviewed.completed", "Completed")} —{" "}
        {t("lesson.summary.score", "Score")}: {correct} / {total}
      </p>
    </section>
  );
}

interface LessonSummaryProps {
  lesson: import("../storage/types").ContentLesson;
  progress: import("../storage/types").LessonProgress | null;
  /** Next lesson's filename within the set, or null when
   *  there is no successor (last lesson OR list not yet
   *  fetched). When null, the "Next lesson" button hides. */
  nextLessonFilename: string | null;
  /** Phase 52F / v1.35.0 — user + set + lesson identifiers
   *  forwarded to the CorrectionBlock so it can load
   *  ElementError rows and persist new ElementAttempt rows
   *  against the same SRS keys. ``userId`` empty disables
   *  the block (anonymous lesson runs have no SRS history). */
  userId: string;
  setId: string;
  /** Resolved set source path (slug with ``--`` → ``/``). */
  source: string;
  /** Raw route slug (``--``-encoded), for the next-lesson href. */
  setSlug: string;
  lessonFilename: string;
  onMarkComplete: () => Promise<void> | void;
  onNextLesson: () => void;
  onRepeat: () => void;
  onExit: () => void;
}

function LessonSummary({
  lesson,
  progress,
  nextLessonFilename,
  userId,
  setId,
  source,
  setSlug,
  lessonFilename,
  onMarkComplete,
  onNextLesson,
  onRepeat,
  onExit,
}: LessonSummaryProps) {
  const { t, lang } = useI18n();
  const intensity = useFeedbackIntensity();
  const correct = progress?.score_correct ?? 0;
  const total = progress?.score_total ?? 0;
  const seconds = progress?.time_spent_seconds ?? 0;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const isCompleted = progress?.status === "completed";

  const stars: StarRating = computeStars(correct, total);
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const breakdown = useMemo(
    () => buildExerciseBreakdown(lesson, progress),
    [lesson, progress],
  );

  // Phase 64 — Smart Next-Step Suggestions. Load this lesson's
  // ElementError rows (lesson_id === filename) so the adaptive
  // suggestion can count + classify the run's mistakes, then
  // derive the full suggestion set. Reads are guarded so the
  // summary still renders if storage is unreachable; the
  // demoted action links below remain a working exit.
  const [sessionErrors, setSessionErrors] = useState<ElementError[]>([]);
  useEffect(() => {
    if (!userId) {
      setSessionErrors([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const errs = await getStorage().elementErrors.list(userId, {
          setId,
        });
        if (cancelled) return;
        setSessionErrors(errs.filter((e) => e.lesson_id === lessonFilename));
      } catch {
        if (!cancelled) setSessionErrors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, setId, lessonFilename]);

  // The exact exercises failed in THIS run — drives the
  // "Retry Errors" card + the ErrorReplay page (via router state).
  const failedExercises = useMemo(
    () => collectFailedExercises(lesson, progress),
    [lesson, progress],
  );

  const suggestions = useNextStepSuggestions({
    source,
    setId,
    lessonFilename,
    userId,
    stars,
    sessionErrors,
    failedExerciseCount: failedExercises.length,
  });

  // #138 — export the result (score + mistakes + weak areas) as
  // Markdown so the learner can paste it into an AI assistant to
  // drill the weak spots. Both actions reuse the breakdown already
  // computed for the on-screen list; no new storage read.
  const buildResultMarkdown = useCallback(() => {
    const now = new Date();
    // #167 bug 5 — ISO 8601 in the export artifact (filename + body),
    // consistent with lessonResultFilename. Locale formatting is for
    // live UI display only, never the exported document.
    const dateStr = now.toISOString().slice(0, 10);
    const labels: LessonResultLabels = {
      title: t("lesson.summary.export.title", "Lesson result"),
      date: t("lesson.summary.export.date", "Date"),
      score: t("lesson.summary.score", "Score"),
      correctWord: t("lesson.summary.export.correct", "correct"),
      mistakesHeading: t("lesson.summary.export.mistakes", "Mistakes"),
      noMistakes: t(
        "lesson.summary.export.no_mistakes",
        "No mistakes - perfect run!",
      ),
      question: t("lesson.summary.export.question", "Question"),
      yourAnswer: t("lesson.summary.export.your_answer", "Your answer"),
      noAnswer: t("lesson.summary.export.no_answer", "(none)"),
      correctAnswer: t("lesson.summary.export.correct_answer", "Correct"),
      weakAreasHeading: t("lesson.summary.export.weak_areas", "Weak areas"),
    };
    return {
      markdown: buildLessonResultMarkdown({
        lessonTitle: lesson.title,
        dateStr,
        correct,
        total,
        pct: scorePct,
        breakdown,
        weakAreas: collectWeakAreas(sessionErrors),
        labels,
      }),
      filename: lessonResultFilename(lesson.title, now),
    };
  }, [
    t,
    lang,
    lesson.title,
    correct,
    total,
    scorePct,
    breakdown,
    sessionErrors,
  ]);

  const handleCopyResult = useCallback(async () => {
    const { markdown } = buildResultMarkdown();
    try {
      await navigator.clipboard.writeText(markdown);
      notify.success(
        t("lesson.summary.export.copied", "Result copied to clipboard"),
      );
    } catch {
      notify.error(
        t("lesson.summary.export.copy_failed", "Could not copy to clipboard"),
      );
    }
  }, [buildResultMarkdown, t]);

  const handleDownloadResult = useCallback(() => {
    const { markdown, filename } = buildResultMarkdown();
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [buildResultMarkdown]);

  // Count the score percentage up from 0 (instant under
  // "subtle" / reduced motion - see useCountUp).
  const animatedPct = useCountUp(scorePct, 1000, intensity !== "subtle");

  // Confetti only on a perfect (3-star) lesson, and only when
  // the intensity allows it. Self-dismisses after the burst.
  const celebrateConfetti = stars === 3 && allowsConfetti(intensity);
  const [showConfetti, setShowConfetti] = useState(celebrateConfetti);

  // The headline message: a "lesson_complete" praise phrase on a
  // perfect run (when phrases are allowed), otherwise the
  // per-star encouraging message. Picked once on mount.
  const ENCOURAGE_FALLBACK: Record<StarRating, string> = {
    0: "Practice makes perfect!",
    1: "Good start - keep going!",
    2: "Almost perfect!",
    3: "Perfect score!",
  };
  const [celebrateMessage] = useState<string>(() => {
    if (stars === 3 && intensity !== "subtle") {
      const picked = nextPraise("lesson_complete", lang);
      if (picked) return picked.phrase;
    }
    return t(`lesson.summary.encourage_${stars}`, ENCOURAGE_FALLBACK[stars]);
  });

  // Fire the lesson-complete celebration sounds once on mount.
  // The star chime + confetti sparkle only on a perfect run.
  const celebrationFired = useRef(false);
  useEffect(() => {
    if (celebrationFired.current) return;
    celebrationFired.current = true;
    emitCelebration({ type: "lesson_complete", payload: { stars } });
    if (stars === 3) {
      emitCelebration({ type: "stars_earned" });
      if (celebrateConfetti) emitCelebration({ type: "confetti" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      className={`lesson-summary${stars === 3 ? " is-celebrating" : ""}`}
      data-testid="lesson-summary"
      data-stars={String(stars)}
      aria-label={t("lesson.summary.aria_label", "Lesson summary")}
    >
      {celebrateConfetti && showConfetti && (
        <Confetti onDone={() => setShowConfetti(false)} />
      )}
      <h2>
        {isCompleted ? <CheckCircle2 size={20} aria-hidden="true" /> : null}
        {t("lesson.summary.heading", "You finished")}: {lesson.title}
      </h2>

      <div
        className="lesson-summary-stars"
        data-testid="lesson-summary-stars"
        role="img"
        aria-label={t("lesson.summary.stars_aria", "{n} of 3 stars").replace(
          "{n}",
          String(stars),
        )}
      >
        {[1, 2, 3].map((n) => {
          const earned = n <= stars;
          return (
            <Star
              key={n}
              size={28}
              aria-hidden="true"
              className={`lesson-summary-star${earned ? " is-earned" : ""}`}
              fill={earned ? "currentColor" : "none"}
              data-earned={earned ? "true" : "false"}
              data-testid={`lesson-summary-star-${n}`}
            />
          );
        })}
      </div>

      <p
        className="lesson-summary-message"
        data-testid="lesson-summary-message"
        data-stars={String(stars)}
      >
        {celebrateMessage}
      </p>

      <div
        className="lesson-summary-score-bar"
        role="progressbar"
        aria-valuenow={scorePct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t(
          "lesson.summary.score_bar_aria",
          "Score: {pct} percent",
        ).replace("{pct}", String(scorePct))}
        data-testid="lesson-summary-score-bar"
      >
        <div
          className="lesson-summary-score-fill"
          style={{ width: `${animatedPct}%` }}
        />
        <span className="lesson-summary-score-label">
          <strong>{t("lesson.summary.score", "Score")}:</strong>{" "}
          <span data-testid="lesson-summary-score">
            {correct} / {total}
          </span>{" "}
          (<span data-testid="lesson-summary-score-pct">{animatedPct}</span>
          %)
        </span>
      </div>

      <ul className="lesson-summary-stats">
        <li>
          <strong>{t("lesson.summary.time", "Time")}:</strong>{" "}
          <span data-testid="lesson-summary-time">
            {t("lesson.summary.minutes", "{n} min").replace(
              "{n}",
              String(minutes),
            )}
          </span>
        </li>
      </ul>

      {breakdown.length > 0 && (
        <section
          className="lesson-summary-breakdown"
          data-testid="lesson-summary-breakdown"
          aria-label={t(
            "lesson.summary.breakdown_heading",
            "Exercise breakdown",
          )}
        >
          <h3>{t("lesson.summary.breakdown_heading", "Exercise breakdown")}</h3>
          <ul className="lesson-summary-breakdown-list">
            {breakdown.map((entry) => {
              const rowStatus = !entry.attempted
                ? "unattempted"
                : entry.fullyCorrect
                  ? "correct"
                  : "wrong";
              return (
                <li
                  key={entry.stepId}
                  className={`lesson-summary-breakdown-row is-${rowStatus}`}
                  data-testid={`lesson-summary-breakdown-${entry.stepId}`}
                  data-status={rowStatus}
                >
                  <span className="lesson-summary-breakdown-title">
                    {entry.title}
                  </span>
                  {entry.attempted ? (
                    <span className="lesson-summary-breakdown-score">
                      {entry.correct} / {entry.total}
                    </span>
                  ) : (
                    <span className="lesson-summary-breakdown-score lesson-summary-breakdown-unattempted">
                      {t(
                        "lesson.summary.breakdown_unattempted",
                        "Not attempted",
                      )}
                    </span>
                  )}
                  {entry.attempted &&
                    !entry.fullyCorrect &&
                    entry.canonicalAnswer &&
                    // Phase 52C / v1.35.0 — when the
                    // stored user_answer is available
                    // (free-text + word-tiles), show
                    // the token-level diff against
                    // the canonical instead of a bare
                    // "Correct answer: X" line. The
                    // bare line stays as the fallback
                    // for matching + picture-choice
                    // (no text answer) and for
                    // lessons stored pre-v1.35.0.
                    (entry.userAnswer ? (
                      <span
                        className="lesson-summary-breakdown-diff"
                        data-testid={`lesson-summary-breakdown-diff-${entry.stepId}`}
                      >
                        <DiffHighlight
                          tokens={tokenDiff(
                            entry.userAnswer,
                            entry.canonicalAnswer,
                          )}
                        />
                      </span>
                    ) : (
                      <span className="lesson-summary-breakdown-canonical">
                        {t(
                          "lesson.summary.breakdown_correct_answer",
                          "Correct answer: {answer}",
                        ).replace("{answer}", entry.canonicalAnswer)}
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* #138 — export the result for AI-assisted practice.
                Copy to clipboard or download as a .md file. Sits
                directly under the breakdown it summarizes. */}
      <div
        className="lesson-summary-export-actions flex flex-wrap gap-2"
        data-testid="lesson-summary-export"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-2"
          onClick={() => {
            void handleCopyResult();
          }}
          data-testid="lesson-summary-copy-result"
        >
          <ClipboardCopy aria-hidden="true" />
          {t("lesson.summary.export.copy", "Copy result")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-2"
          onClick={handleDownloadResult}
          data-testid="lesson-summary-download-result"
        >
          <Download aria-hidden="true" />
          {t("lesson.summary.export.download", "Save as file")}
        </Button>
      </div>

      {/* Phase 52F / v1.35.0 — correction round. Self-hides
                when the lesson was a perfect score, when no
                ElementError rows exist for it, OR when no cloze
                can be generated from the available errors. Users
                can skip; the Next-lesson button below stays
                visible throughout. */}
      {progress && userId && (
        <CorrectionBlock
          lesson={lesson}
          progress={progress}
          userId={userId}
          setId={setId}
          lessonFilename={lessonFilename}
          onComplete={() => {
            // Best-effort improvement counter is rendered
            // inside CorrectionBlock's "complete" surface;
            // nothing further needed at the parent level.
          }}
          onSkip={() => {
            // Skip is purely a UI dismissal — the action
            // row below was always visible.
          }}
        />
      )}

      {/* Completion is a distinct action from navigation, so
                it keeps its own prominent button above the smart
                suggestion cards. */}
      {!isCompleted && (
        <div className="lesson-summary-actions">
          <Button
            type="button"
            onClick={() => {
              void onMarkComplete();
            }}
            data-testid="lesson-summary-mark-complete"
          >
            {t("lesson.summary.mark_complete", "Mark as complete")}
          </Button>
        </div>
      )}

      {/* Phase 64 — Smart Next-Step Suggestions. The primary
                navigation surface; the standalone Next button below
                is only a graceful-degradation fallback. */}
      <NextStepSuggestions
        suggestions={suggestions}
        setId={setId}
        setSlug={setSlug}
        lessonFilename={lessonFilename}
        errorReplay={
          failedExercises.length > 0
            ? {
                exercises: failedExercises,
                cards: lesson.cards,
                lessonTitle: lesson.title,
              }
            : undefined
        }
      />

      <div className="lesson-summary-secondary-actions">
        {/* Fallback Next link — only when the smart card is
                    not surfacing a successor (hook still loading or a
                    storage read failed) but one exists. */}
        {!suggestions.nextLesson.available && nextLessonFilename && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNextLesson}
            data-testid="lesson-summary-next"
          >
            {t("lesson.summary.next_lesson", "Next lesson")}
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRepeat}
          data-testid="lesson-summary-repeat"
        >
          <RotateCcw aria-hidden="true" />
          {t("lesson.summary.repeat", "Repeat lesson")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onExit}
          data-testid="lesson-summary-exit"
        >
          {t("lesson.summary.back_to_browser", "Back to content browser")}
        </Button>
      </div>
    </section>
  );
}
