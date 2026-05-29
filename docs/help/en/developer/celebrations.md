# Celebration layer

The celebration layer (EXP-008, Phase 55) adds the emotional
feedback on top of the existing mechanical tracking. It is
frontend-only and works in both storage modes.

## Pieces

| Module | Role |
|---|---|
| `lib/praise/phrase-picker.ts` | No-repeat praise-phrase cycling, reads `data/praise/{lang}.json` (bundled from `backend/config/praise/*.yaml` via `make sync-praise`). |
| `lib/feedback/feedbackPref.ts` | Intensity (`subtle`/`normal`/`enthusiastic`) + sound prefs in localStorage; reduced-motion override; per-level gating + frequency helpers. |
| `hooks/useFeedbackIntensity.ts` | Live effective intensity (re-reads on pref change + reduced-motion change). |
| `lib/feedback/milestones.ts` | Pure threshold detection (streak/mastery/level). |
| `lib/feedback/celebrationQueue.ts` | Module-level FIFO with id de-dup; one listener (the host). |
| `lib/praise/celebration-bus.ts` | `emitCelebration` (plays the mapped sound + notifies subscribers) and the `celebrate*` milestone helpers. |
| `lib/feedback/celebration-stats.ts` | Snapshots gamification + drives milestone/badge celebration at completion. |
| `lib/audio/sound-effects.ts` | Runtime-synthesized sounds (no audio files). |
| `components/exercises/AnswerCelebration.tsx` | Per-answer haptic + praise + bus emit. |
| `components/feedback/Confetti.tsx` | CSS-only confetti burst. |
| `components/feedback/MilestoneHost.tsx` + `MilestoneOverlay.tsx` | Drains the queue, shows one overlay at a time. |

## Flow

1. An exercise renders `<AnswerCelebration isCorrect>`; it fires a
   haptic, picks a phrase (intensity + frequency gated), and emits
   `answer_correct`/`answer_wrong` on the bus.
2. `emitCelebration` plays the mapped sound (self-gated on the
   sound preference) and notifies subscribers.
3. On lesson completion the page snapshots gamification, runs the
   award, then `celebrateProgressSince` detects milestones +
   badges and routes them through `celebrateMilestone`, which
   enqueues an overlay and emits a sound. `MilestoneHost` shows
   the overlays sequentially.

## Rules

- All animations are CSS (transform + opacity); no animation
  libraries. `prefers-reduced-motion` suppresses every animation
  and forces the effective intensity to `subtle`.
- Sounds are synthesized at runtime from additive recipes
  (`renderSamples` is the pure, testable core); the `AudioContext`
  is created lazily on the first play inside a user gesture.
- The celebration layer is supplementary: every cue is also
  visible. A failure in it must never break the lesson flow (the
  stat reads are defensive).
