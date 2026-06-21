/**
 * Lesson Creator draft persistence (Phase 65B / EXP-021).
 *
 * Auto-saves the in-progress lesson to localStorage so a closed
 * tab / reload never loses the user's work. One draft slot; cleared
 * on successful save or explicit discard.
 */

export const LESSON_DRAFT_KEY = "adaptive-learner.lesson-draft";

/** Step-1 metadata. Lives here (not in the page component) so the
 *  draft module and the page can share the type without a circular
 *  import. */
export interface LessonMeta {
    title: string;
    titleNative: string;
    sourceLanguage: string;
    targetLanguage: string;
    level: string;
    description: string;
    author: string;
}

export interface LessonCardDraft {
    id: string;
    front: string;
    back: string;
    notes: string;
    image: string;
}

export interface LessonDraft {
    schema: 1;
    step: number;
    meta: LessonMeta;
    cards: LessonCardDraft[];
    updatedAt: string;
}

let _idSeq = 0;

/** Stable-ish id for a new card (sortable key + React key). */
export function newCardId(): string {
    _idSeq += 1;
    return `card-${Date.now().toString(36)}-${_idSeq}`;
}

/** A blank card draft with a fresh id and empty fields. */
export function emptyCard(): LessonCardDraft {
    return {id: newCardId(), front: "", back: "", notes: "", image: ""};
}

/** Persist the in-progress draft to localStorage, stamping a fresh
 *  ``updatedAt``. Best-effort: a storage failure is swallowed (drafting
 *  is non-critical). */
export function saveLessonDraft(draft: LessonDraft): void {
    try {
        localStorage.setItem(
            LESSON_DRAFT_KEY,
            JSON.stringify({...draft, updatedAt: new Date().toISOString()}),
        );
    } catch {
        /* storage full / unavailable — drafting is best-effort */
    }
}

/** Load + defensively validate a stored draft. Returns null when no
 *  draft exists or the stored shape is unusable. */
export function loadLessonDraft(): LessonDraft | null {
    let raw: string | null;
    try {
        raw = localStorage.getItem(LESSON_DRAFT_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<LessonDraft>;
        if (!parsed || typeof parsed !== "object" || !parsed.meta) return null;
        const meta = parsed.meta as Partial<LessonMeta>;
        if (typeof meta.title !== "string") return null;
        const cards = Array.isArray(parsed.cards)
            ? (parsed.cards as LessonCardDraft[]).filter(
                  (c) => c && typeof c.front === "string",
              )
            : [];
        const sourceLanguage = meta.sourceLanguage ?? "en";
        let targetLanguage = meta.targetLanguage ?? "fr";
        if (targetLanguage === sourceLanguage) {
            // A stale or hand-edited draft with an EQUAL language pair
            // would leave Step 1 permanently unadvanceable: the
            // same-language guard never clears, so "Next" silently does
            // nothing no matter what else the user fills in. Repair to a
            // sane different default so a resumed draft is always usable.
            targetLanguage = sourceLanguage === "en" ? "fr" : "en";
        }
        return {
            schema: 1,
            step: typeof parsed.step === "number" ? parsed.step : 1,
            meta: {
                title: meta.title ?? "",
                titleNative: meta.titleNative ?? "",
                sourceLanguage,
                targetLanguage,
                level: meta.level ?? "A1",
                description: meta.description ?? "",
                author: meta.author ?? "",
            },
            cards: cards.map((c) => ({
                id: c.id || newCardId(),
                front: c.front ?? "",
                back: c.back ?? "",
                notes: c.notes ?? "",
                image: c.image ?? "",
            })),
            updatedAt: parsed.updatedAt ?? new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

/** Remove the stored draft (on successful save or explicit discard). */
export function clearLessonDraft(): void {
    try {
        localStorage.removeItem(LESSON_DRAFT_KEY);
    } catch {
        /* ignore */
    }
}

/** True when the draft carries anything worth restoring. */
export function draftHasContent(draft: LessonDraft | null): boolean {
    if (!draft) return false;
    return (
        draft.meta.title.trim().length > 0 ||
        draft.meta.description.trim().length > 0 ||
        draft.cards.length > 0
    );
}
