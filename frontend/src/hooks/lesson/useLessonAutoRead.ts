/**
 * Lesson read-aloud (TTS) engine + behaviours (extracted from
 * Lesson.tsx, #404).
 *
 * Owns the shared {@link useReadAloud} controller and the lesson-level
 * read-aloud behaviours layered on top of it:
 *
 *   - auto-read mode (speak each new step on display, off by default,
 *     remembered),
 *   - the "R" keyboard shortcut (toggle read-aloud of the current step),
 *   - continuous theory reading ("Read all" — one utterance across a run
 *     of consecutive theory steps, auto-advancing the viewer at each
 *     step boundary),
 *   - the mini-player's theory-block position + per-step skip.
 *
 * The page wires the returned ``tts`` into TheoryStep + the mini-player
 * and the rest into the TTS control bar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolveCodeContext } from "../../components/exercises/ExerciseDispatcher";
import {
  readLessonAutoRead,
  useReadAloud,
  writeLessonAutoRead,
} from "./useReadAloud";
import {
  collectTheoryRun,
  markdownToSpeech,
  runStepForChar,
  theoryBlockAround,
  type TheoryRun,
} from "../../lib/lesson/tts-text";
import type { ContentLesson } from "../../storage/types";

interface UseLessonAutoReadDeps {
  lesson: ContentLesson | null;
  currentStepIndex: number;
  showResumePrompt: boolean;
  goToStep: (index: number) => void;
}

export function useLessonAutoRead({
  lesson,
  currentStepIndex,
  showResumePrompt,
  goToStep,
}: UseLessonAutoReadDeps) {
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

  return {
    tts,
    autoRead,
    toggleAutoRead,
    startContinuous,
    isContinuous,
    theoryBlock,
    readTheoryStepAt,
    continuousAvailable,
  };
}
