/**
 * Lesson theory-anchor resolution (Phase 44 / EXP-002 / P-108).
 *
 * Content authors can cross-reference other steps from inside a
 * theory body using the convention
 * ``[link text](theory.md#step-id)``. The viewer renders each
 * theory step independently, so a raw ``theory.md`` href would
 * 404 in the browser — the resolver rewrites such links to a
 * stable in-app anchor that the viewer's react-markdown
 * pipeline + step-navigation handler understand.
 *
 * Pure functions: no state, no fetches. The viewer calls
 * ``rewriteAnchors`` before handing the Markdown to
 * react-markdown.
 */

import type {ContentLesson, ContentLessonStep} from "../storage/types";

/**
 * In-app step-anchor prefix the viewer recognises. A link
 * with ``href={LESSON_STEP_ANCHOR_PREFIX}{step_id}`` jumps to
 * the named step inside the same lesson.
 */
export const LESSON_STEP_ANCHOR_PREFIX = "#lesson-step-";

/**
 * Matches the conventional ``theory.md#step-id`` href shape
 * (with optional ``./`` / ``/`` prefixes). The capture group
 * is the step id.
 */
const THEORY_ANCHOR_RE =
    /\(\s*\.?\/?theory\.md#([A-Za-z0-9_-]+)\s*\)/g;

/**
 * Bare ``#step-id`` references inside a theory body. These
 * already look like in-page anchors and only need rewriting if
 * the target is a known step id — otherwise we leave them
 * alone so authors can keep using ``#table-of-contents`` style
 * headings inside a single theory body.
 */
const BARE_HASH_RE = /\(#([A-Za-z0-9_-]+)\)/g;

/**
 * Build the set of step ids the lesson exposes for anchor
 * resolution. The viewer uses this to verify each rewrite
 * targets a real step; unknown ids stay verbatim so they
 * 404 visibly instead of silently jumping to nothing.
 */
function _stepIdSet(lesson: ContentLesson): Set<string> {
    return new Set(lesson.steps.map((s) => s.id));
}

/**
 * Rewrite every ``theory.md#step-id`` reference in a Markdown
 * body to ``#lesson-step-{step_id}`` so the in-app anchor
 * handler can intercept the click and navigate to the step.
 *
 * Bare ``#step-id`` references are also rewritten when the id
 * matches a known step. Unknown ids stay verbatim.
 */
export function rewriteAnchors(
    body: string,
    lesson: ContentLesson,
): string {
    const known = _stepIdSet(lesson);
    let rewritten = body.replace(
        THEORY_ANCHOR_RE,
        (_match, stepId: string) => {
            if (!known.has(stepId)) return `(theory.md#${stepId})`;
            return `(${LESSON_STEP_ANCHOR_PREFIX}${stepId})`;
        },
    );
    rewritten = rewritten.replace(
        BARE_HASH_RE,
        (match, stepId: string) => {
            if (!known.has(stepId)) return match;
            return `(${LESSON_STEP_ANCHOR_PREFIX}${stepId})`;
        },
    );
    return rewritten;
}

/**
 * Parse a click target (``event.currentTarget.href`` after
 * react-markdown renders the link). When the href is an
 * in-lesson step anchor, returns the step id; otherwise
 * returns ``null`` and the click should fall through to the
 * browser's default handler (open in new tab / external nav).
 */
export function parseStepAnchor(href: string): string | null {
    const idx = href.indexOf(LESSON_STEP_ANCHOR_PREFIX);
    if (idx === -1) return null;
    const stepId = href.slice(idx + LESSON_STEP_ANCHOR_PREFIX.length);
    return stepId || null;
}

/**
 * Look up a step by id. Returns the step + its zero-based
 * position in ``lesson.steps`` so the viewer can both render
 * the step content and update its current-step state.
 */
export function findStepById(
    lesson: ContentLesson,
    stepId: string,
): {step: ContentLessonStep; index: number} | null {
    for (let i = 0; i < lesson.steps.length; i++) {
        if (lesson.steps[i].id === stepId) {
            return {step: lesson.steps[i], index: i};
        }
    }
    return null;
}
