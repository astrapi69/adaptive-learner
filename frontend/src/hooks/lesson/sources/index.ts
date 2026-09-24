/**
 * Runner source adapters (EXP-052, refs #3169): one hook per runner
 * that calls the mode hook as the page did and normalises the result
 * to the shell's ``RunnerSource``. Slice 1 shipped the review adapter,
 * slice 2 the shuffle and endless adapters, slice 3 the adaptive and
 * error-replay adapters; slice 4 adds the lesson. The barrel carries the
 * consumed surface only (dead-code ratchet, #2741); the legacy id parser
 * is reached through its file by its test.
 */

export { useAdaptiveSource } from "./useAdaptiveSource";
export { useEndlessSource } from "./useEndlessSource";
export { useErrorReplaySource, type ReplayState } from "./useErrorReplaySource";
export { useReviewSource } from "./useReviewSource";
export { useShuffleSource } from "./useShuffleSource";
