/**
 * Runner source adapters (EXP-052, refs #3169): one hook per runner
 * that calls the mode hook as the page did and normalises the result
 * to the shell's ``RunnerSource``. Slice 1 ships the review adapter;
 * slices 2 to 4 add shuffle, endless, adaptive, error replay and lesson.
 * The barrel carries the consumed surface only (dead-code ratchet,
 * #2741); the legacy id parser is reached through its file by its test.
 */

export { useReviewSource } from "./useReviewSource";
