/**
 * Shared "does focusing this element summon the on-screen keyboard?"
 * logic (#3002) — consumed by ``useVisualViewportRealign`` (stand down
 * while a text field holds focus, #2983) and ``useKeyboardPreReveal``
 * (scroll the field into the safe zone BEFORE Safari's reveal, #3002).
 */

/**
 * Input types that never open an on-screen keyboard — focus on these
 * must not block the realign (the #1569 checkbox mis-tap is exactly the
 * case the realign hook exists for) and needs no pre-reveal.
 */
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "radio",
  "range",
  "color",
  "submit",
  "reset",
  "file",
]);

/**
 * Whether ``el`` is a text-entry element that summons the keyboard.
 * ``select`` counts: iOS shows a picker whose reveal behaves like the
 * keyboard's for the realign guard.
 */
export function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * Like {@link isTextEntry} but WITHOUT ``select``: the iOS select picker
 * overlays instead of panning to a caret, so pre-revealing it would move
 * the page for nothing (#3002).
 */
export function isKeyboardSummoner(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === "SELECT") return false;
  return isTextEntry(el);
}
