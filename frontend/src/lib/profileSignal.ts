/**
 * Cross-component "the learner's profile changed" signal (#579).
 *
 * Settings owns the profile edit (display name + picture); the header
 * {@link NavAvatar} renders a copy of the same data. Rather than thread a
 * shared store between them, Settings fires this window event after a save and
 * NavAvatar re-reads from storage — the same decoupled pattern the preference
 * toggles use (e.g. lessonShortcutsPref). Keeps the avatar live without a
 * reload or a route change.
 */

export const PROFILE_UPDATED_EVENT = "adaptive-learner:profile-updated";

/** Notify listeners (e.g. NavAvatar) that the name/avatar was saved. */
export function notifyProfileUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  }
}
